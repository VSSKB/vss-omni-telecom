/**
 * VSS OTTB - CDR and Recording API Endpoints
 * F-13: CDR Collection, F-14: SIP Call Recording
 */

module.exports = function(app, pool, rabbitmqChannel) {
    // ============================================
    // CDR API (F-13: CDR Collection)
    // ============================================

    // GET /api/cdr/records - Получить CDR записи
    app.get('/api/cdr/records', async (req, res) => {
        try {
            const { slot_id, call_id, start_time, end_time, limit = 100 } = req.query;
            
            let query = 'SELECT * FROM cdr_records WHERE 1=1';
            const params = [];
            let paramIndex = 1;
            
            if (slot_id) {
                query += ` AND slot_id = $${paramIndex++}`;
                params.push(parseInt(slot_id));
            }
            
            if (call_id) {
                query += ` AND call_id = $${paramIndex++}`;
                params.push(parseInt(call_id));
            }
            
            if (start_time) {
                query += ` AND start_time >= $${paramIndex++}`;
                params.push(start_time);
            }
            
            if (end_time) {
                query += ` AND start_time <= $${paramIndex++}`;
                params.push(end_time);
            }
            
            query += ` ORDER BY start_time DESC LIMIT $${paramIndex++}`;
            params.push(parseInt(limit));
            
            const result = await pool.query(query, params);
            res.json(result.rows);
        } catch (error) {
            console.error('[OTTB] Error fetching CDR records:', error);
            res.status(500).json({ error: true, code: 'CDR_FETCH_ERROR', message: error.message });
        }
    });

    // GET /api/cdr/record/:id - Получить конкретную CDR запись
    app.get('/api/cdr/record/:id', async (req, res) => {
        try {
            const recordId = parseInt(req.params.id);
            
            const result = await pool.query(`
                SELECT * FROM cdr_records WHERE id = $1
            `, [recordId]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: true, code: 'CDR_NOT_FOUND', message: 'CDR record not found' });
            }
            
            res.json(result.rows[0]);
        } catch (error) {
            console.error('[OTTB] Error fetching CDR record:', error);
            res.status(500).json({ error: true, code: 'CDR_FETCH_ERROR', message: error.message });
        }
    });

    // GET /api/cdr/stats - Статистика CDR
    app.get('/api/cdr/stats', async (req, res) => {
        try {
            const { start_time, end_time } = req.query;
            
            let query = `
                SELECT 
                    COUNT(*) as total_calls,
                    SUM(duration) as total_duration,
                    AVG(duration) as avg_duration,
                    SUM(rtp_bytes_sent + rtp_bytes_received) as total_bytes,
                    COUNT(CASE WHEN sip_status_code = 200 THEN 1 END) as successful_calls,
                    COUNT(CASE WHEN sip_status_code != 200 THEN 1 END) as failed_calls
                FROM cdr_records
                WHERE 1=1
            `;
            const params = [];
            let paramIndex = 1;
            
            if (start_time) {
                query += ` AND start_time >= $${paramIndex++}`;
                params.push(start_time);
            }
            
            if (end_time) {
                query += ` AND start_time <= $${paramIndex++}`;
                params.push(end_time);
            }
            
            const result = await pool.query(query, params);
            res.json(result.rows[0]);
        } catch (error) {
            console.error('[OTTB] Error fetching CDR stats:', error);
            res.status(500).json({ error: true, code: 'CDR_STATS_ERROR', message: error.message });
        }
    });

    // ============================================
    // RECORDING API (F-14: SIP Call Recording)
    // ============================================

    // GET /api/recordings - Получить список записей
    app.get('/api/recordings', async (req, res) => {
        try {
            const { call_id, slot_id, status, limit = 100 } = req.query;
            
            let query = 'SELECT * FROM call_recordings WHERE 1=1';
            const params = [];
            let paramIndex = 1;
            
            if (call_id) {
                query += ` AND call_id = $${paramIndex++}`;
                params.push(parseInt(call_id));
            }
            
            if (slot_id) {
                query += ` AND slot_id = $${paramIndex++}`;
                params.push(parseInt(slot_id));
            }
            
            if (status) {
                query += ` AND status = $${paramIndex++}`;
                params.push(status);
            }
            
            query += ` ORDER BY started_at DESC LIMIT $${paramIndex++}`;
            params.push(parseInt(limit));
            
            const result = await pool.query(query, params);
            res.json(result.rows);
        } catch (error) {
            console.error('[OTTB] Error fetching recordings:', error);
            res.status(500).json({ error: true, code: 'RECORDINGS_FETCH_ERROR', message: error.message });
        }
    });

    // GET /api/recordings/:id - Получить конкретную запись
    app.get('/api/recordings/:id', async (req, res) => {
        try {
            const recordingId = parseInt(req.params.id);
            
            const result = await pool.query(`
                SELECT * FROM call_recordings WHERE id = $1
            `, [recordingId]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: true, code: 'RECORDING_NOT_FOUND', message: 'Recording not found' });
            }
            
            res.json(result.rows[0]);
        } catch (error) {
            console.error('[OTTB] Error fetching recording:', error);
            res.status(500).json({ error: true, code: 'RECORDING_FETCH_ERROR', message: error.message });
        }
    });

    // POST /api/recordings/start - Начать запись звонка
    app.post('/api/recordings/start', async (req, res) => {
        try {
            const { call_id, slot_id, recording_type = 'audio' } = req.body;
            
            if (!call_id || !slot_id) {
                return res.status(400).json({ error: true, code: 'INVALID_PARAMS', message: 'call_id and slot_id are required' });
            }
            
            const filePath = `/recordings/call_${call_id}_${Date.now()}.${recording_type === 'video' ? 'mp4' : 'wav'}`;
            
            const result = await pool.query(`
                INSERT INTO call_recordings (call_id, slot_id, recording_type, file_path, status, started_at)
                VALUES ($1, $2, $3, $4, 'recording', NOW())
                RETURNING id
            `, [call_id, slot_id, recording_type, filePath]);
            
            const recordingId = result.rows[0].id;
            
            // Publish F-14 event
            if (rabbitmqChannel) {
                rabbitmqChannel.publish('vss.events', 'recording.start', Buffer.from(JSON.stringify({
                    event: 'recording.start',
                    recording_id: recordingId,
                    call_id: call_id,
                    slot_id: slot_id,
                    recording_type: recording_type,
                    file_path: filePath,
                    f_flow: 'F-14',
                    timestamp: new Date().toISOString()
                })));
            }
            
            res.json({ recording_id: recordingId, file_path: filePath, status: 'recording' });
        } catch (error) {
            console.error('[OTTB] Error starting recording:', error);
            res.status(500).json({ error: true, code: 'RECORDING_START_ERROR', message: error.message });
        }
    });

    // POST /api/recordings/:id/stop - Остановить запись
    app.post('/api/recordings/:id/stop', async (req, res) => {
        try {
            const recordingId = parseInt(req.params.id);
            
            const result = await pool.query(`
                UPDATE call_recordings 
                SET status = 'completed', completed_at = NOW(),
                    duration = EXTRACT(EPOCH FROM (NOW() - started_at))::int
                WHERE id = $1
                RETURNING *
            `, [recordingId]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: true, code: 'RECORDING_NOT_FOUND', message: 'Recording not found' });
            }
            
            const recording = result.rows[0];
            
            // Publish F-14 event
            if (rabbitmqChannel) {
                rabbitmqChannel.publish('vss.events', 'recording.completed', Buffer.from(JSON.stringify({
                    event: 'recording.completed',
                    recording_id: recordingId,
                    call_id: recording.call_id,
                    slot_id: recording.slot_id,
                    duration: recording.duration,
                    file_path: recording.file_path,
                    f_flow: 'F-14',
                    timestamp: new Date().toISOString()
                })));
            }
            
            res.json({ recording_id: recordingId, status: 'completed', duration: recording.duration });
        } catch (error) {
            console.error('[OTTB] Error stopping recording:', error);
            res.status(500).json({ error: true, code: 'RECORDING_STOP_ERROR', message: error.message });
        }
    });

    // GET /api/recordings/:id/download - Скачать запись
    app.get('/api/recordings/:id/download', async (req, res) => {
        try {
            const recordingId = parseInt(req.params.id);
            
            const result = await pool.query(`
                SELECT file_path, file_format, file_size FROM call_recordings WHERE id = $1
            `, [recordingId]);
            
            if (result.rows.length === 0) {
                return res.status(404).json({ error: true, code: 'RECORDING_NOT_FOUND', message: 'Recording not found' });
            }
            
            const recording = result.rows[0];
            
            // In real implementation, serve file from storage
            // For now, return file path
            res.json({ 
                file_path: recording.file_path,
                download_url: `/recordings/${recordingId}/file`
            });
        } catch (error) {
            console.error('[OTTB] Error getting recording download:', error);
            res.status(500).json({ error: true, code: 'RECORDING_DOWNLOAD_ERROR', message: error.message });
        }
    });
};

