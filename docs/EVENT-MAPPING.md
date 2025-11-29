# VSS OTTB UI - Event Mapping
## Complete Event Mapping for All Screens and Components

### SCREEN: LOGIN

**COMPONENTS:**

**BUTTON: signin "[ SIGN IN ]"**
- **EVENT:** `auth.login`
- **TRIGGER:** `onClick`
- **TARGET:** `/api/auth/login`
- **PAYLOAD:** `{ username, password }`
- **SUCCESS:** `auth.success` → Redirect to DASHBOARD
- **FAIL:** `auth.fail` → Show error message

---

### SCREEN: DASHBOARD

**COMPONENTS:**

**FEED_ROW: call.start**
- **EVENT:** `call.update`
- **TRIGGER:** WebSocket
- **TARGET:** CALL_FEED
- **PAYLOAD:** `{ call_id, slot, state, f_flow: 'F-03' }`

**FEED_ROW: pipeline.update**
- **EVENT:** `pipeline.update`
- **TRIGGER:** WebSocket
- **TARGET:** DASHBOARD
- **PAYLOAD:** `{ pipeline_id, status, f_flow: 'F-11' }`

**METRIC: active_slots**
- **EVENT:** `slot.update`
- **TRIGGER:** WebSocket
- **TARGET:** METRICS_PANEL
- **PAYLOAD:** `{ slot_id, status, fsm_state, f_flow: 'F-05' }`

**METRIC: total_hosts**
- **EVENT:** `trunk.update`
- **TRIGGER:** WebSocket
- **TARGET:** METRICS_PANEL
- **PAYLOAD:** `{ trunk_id, status }`

**METRIC: online_hosts**
- **EVENT:** `trunk.status`
- **TRIGGER:** WebSocket
- **TARGET:** METRICS_PANEL
- **PAYLOAD:** `{ trunk_id, state: 'OK' | 'ERROR' }`

**METRIC: total_slots**
- **EVENT:** `slot.update`
- **TRIGGER:** WebSocket
- **TARGET:** METRICS_PANEL
- **PAYLOAD:** `{ slot_id, status }`

**METRIC: free_slots**
- **EVENT:** `slot.update`
- **TRIGGER:** WebSocket
- **TARGET:** METRICS_PANEL
- **PAYLOAD:** `{ slot_id, status: 'free' }`

**METRIC: active_calls**
- **EVENT:** `call.update`
- **TRIGGER:** WebSocket
- **TARGET:** METRICS_PANEL
- **PAYLOAD:** `{ call_id, status: 'connected' | 'ringing' }`

---

### SCREEN: SLOT_GRID

**COMPONENTS:**

**ROW: slot_detail**
- **EVENT:** `open.detail`
- **TRIGGER:** `onClick DETAIL`
- **TARGET:** SLOT_DETAIL
- **PAYLOAD:** `{ slot_id }`

**ROW: slot_restart**
- **EVENT:** `slot.restart`
- **TRIGGER:** `onClick RESTART`
- **TARGET:** `/api/slots/:id/restart`
- **PAYLOAD:** `{ slot_id }`
- **F-FLOW:** F-05, F-06

**ROW: slot_view**
- **EVENT:** `guacamole.open`
- **TRIGGER:** `onClick VIEW`
- **TARGET:** GUACAMOLE
- **PAYLOAD:** `{ slot_id, protocol: 'rdp' | 'vnc' | 'ssh' }`

**ROW: slot_call**
- **EVENT:** `call.start`
- **TRIGGER:** `onClick CALL`
- **TARGET:** `/api/call/start`
- **PAYLOAD:** `{ slot_id, number }`
- **F-FLOW:** F-03

**ROW: slot_gacs**
- **EVENT:** `gacs.execute`
- **TRIGGER:** `onClick GACS`
- **TARGET:** `/api/slots/:id/gacs`
- **PAYLOAD:** `{ slot_id, script_name, script_type }`
- **F-FLOW:** F-02

---

### SCREEN: SLOT_DETAIL

**COMPONENTS:**

**BUTTONS:**

**RESTART SLOT**
- **EVENT:** `slot.restart`
- **TRIGGER:** `onClick`
- **TARGET:** `/api/slots/:id/restart`
- **PAYLOAD:** `{ slot_id }`
- **F-FLOW:** F-05, F-06

**REBOOT DEVICE**
- **EVENT:** `slot.reboot`
- **TRIGGER:** `onClick`
- **TARGET:** `/api/slots/:id/reboot-device`
- **PAYLOAD:** `{ slot_id }`
- **F-FLOW:** F-06

**STOP CALL**
- **EVENT:** `call.end`
- **TRIGGER:** `onClick`
- **TARGET:** `/api/call/end`
- **PAYLOAD:** `{ call_id }`
- **F-FLOW:** F-08

**START CALL**
- **EVENT:** `call.start`
- **TRIGGER:** `onClick`
- **TARGET:** `/api/call/start`
- **PAYLOAD:** `{ slot_id, number }`
- **F-FLOW:** F-03

**EXECUTE GACS**
- **EVENT:** `gacs.execute`
- **TRIGGER:** `onClick`
- **TARGET:** `/api/slots/:id/gacs`
- **PAYLOAD:** `{ slot_id, script_name, script_type: 'whatsapp' | 'telegram' | 'adb' }`
- **F-FLOW:** F-02

**VIEW RTMP STREAM**
- **EVENT:** `rtmp.view`
- **TRIGGER:** `onClick`
- **TARGET:** RTMP_PLAYER
- **PAYLOAD:** `{ slot_id, stream_url }`
- **F-FLOW:** F-04

**METRICS:**
- **EVENT:** `slot.metrics.update`
- **TRIGGER:** WebSocket
- **TARGET:** METRICS_PANEL
- **PAYLOAD:** `{ slot_id, cpu, ram, temperature, battery, fsm_state }`

---

### SCREEN: CALL_PAD

**COMPONENTS:**

**BUTTON: start_call**
- **EVENT:** `call.start`
- **TRIGGER:** `onClick`
- **TARGET:** `/api/call/start`
- **PAYLOAD:** `{ number, slot }`
- **SUCCESS:** `call.update` → CALL_FEED
- **F-FLOW:** F-03

**INPUT: phone_number**
- **EVENT:** `call.number.input`
- **TRIGGER:** `onChange`
- **TARGET:** LOCAL_STATE
- **PAYLOAD:** `{ number }`

**SELECT: slot_selector**
- **EVENT:** `slot.select`
- **TRIGGER:** `onChange`
- **TARGET:** LOCAL_STATE
- **PAYLOAD:** `{ slot_id }`

---

### SCREEN: CALL_FEED

**COMPONENTS:**

**FEED_ROW: call_detail**
- **EVENT:** `open.detail`
- **TRIGGER:** `onClick DETAIL`
- **TARGET:** CALL_DETAIL
- **PAYLOAD:** `{ call_id }`

**FEED_ROW: call_end**
- **EVENT:** `call.end`
- **TRIGGER:** `onClick END`
- **TARGET:** `/api/call/end`
- **PAYLOAD:** `{ call_id }`
- **F-FLOW:** F-08

**FEED_ROW: call_update**
- **EVENT:** `call.update`
- **TRIGGER:** WebSocket
- **TARGET:** CALL_FEED
- **PAYLOAD:** `{ call_id, slot_id, state, duration, f_flow: 'F-03' | 'F-08' }`

---

### SCREEN: CALL_DETAIL

**COMPONENTS:**

**CONTROLS:**

**END CALL**
- **EVENT:** `call.end`
- **TRIGGER:** `onClick`
- **TARGET:** `/api/call/end`
- **PAYLOAD:** `{ call_id }`
- **F-FLOW:** F-08

**TRANSFER**
- **EVENT:** `call.transfer`
- **TRIGGER:** `onClick`
- **TARGET:** `/api/call/transfer`
- **PAYLOAD:** `{ call_id, new_slot }`
- **F-FLOW:** F-03

**MUTE**
- **EVENT:** `call.mute`
- **TRIGGER:** `onClick`
- **TARGET:** `/api/call/mute`
- **PAYLOAD:** `{ call_id }`

**RECORD**
- **EVENT:** `call.record`
- **TRIGGER:** `onClick`
- **TARGET:** `/api/call/record`
- **PAYLOAD:** `{ call_id }`
- **F-FLOW:** F-14

**NOTES:**

**ADD NOTE**
- **EVENT:** `crm.note.add`
- **TRIGGER:** `onEnter`
- **TARGET:** `/api/crm/note`
- **PAYLOAD:** `{ call_id, text }`

**VIEW NOTES**
- **EVENT:** `crm.notes.get`
- **TRIGGER:** `onLoad`
- **TARGET:** `/api/crm/notes/:call_id`
- **PAYLOAD:** `{ call_id }`

**CDR INFO:**
- **EVENT:** `cdr.update`
- **TRIGGER:** WebSocket
- **TARGET:** CDR_PANEL
- **PAYLOAD:** `{ call_id, duration, rtp_bytes, quality_metrics, f_flow: 'F-13' }`

**RECORDING:**
- **EVENT:** `recording.update`
- **TRIGGER:** WebSocket
- **TARGET:** RECORDING_PLAYER
- **PAYLOAD:** `{ call_id, file_path, duration, f_flow: 'F-14' }`

---

### SCREEN: AUTODIALER

**COMPONENTS:**

**CAMPAIGN: start_campaign**
- **EVENT:** `campaign.start`
- **TRIGGER:** `onClick`
- **TARGET:** `/api/autodialer/run-campaign`
- **PAYLOAD:** `{ campaign_id, leads: [{ phone_number, lead_data }] }`
- **F-FLOW:** F-01

**CAMPAIGN: stop_campaign**
- **EVENT:** `campaign.stop`
- **TRIGGER:** `onClick`
- **TARGET:** `/api/autodialer/stop-campaign`
- **PAYLOAD:** `{ campaign_id }`
- **F-FLOW:** F-11

**CAMPAIGN: status_update**
- **EVENT:** `campaign.status`
- **TRIGGER:** WebSocket
- **TARGET:** CAMPAIGN_PANEL
- **PAYLOAD:** `{ campaign_id, status, total_leads, dialed_leads, connected_leads, f_flow: 'F-11' }`

**LEAD: lead_update**
- **EVENT:** `autodial.lead.update`
- **TRIGGER:** WebSocket
- **TARGET:** LEAD_FEED
- **PAYLOAD:** `{ lead_id, status, slot_id, call_id, f_flow: 'F-01' }`

---

### SCREEN: GACS_SCRIPTS

**COMPONENTS:**

**SCRIPT: execute_script**
- **EVENT:** `gacs.execute`
- **TRIGGER:** `onClick`
- **TARGET:** `/api/slots/:id/gacs`
- **PAYLOAD:** `{ slot_id, script_name, script_type, script_content }`
- **F-FLOW:** F-02

**SCRIPT: script_status**
- **EVENT:** `gacs.event`
- **TRIGGER:** WebSocket
- **TARGET:** SCRIPT_STATUS_PANEL
- **PAYLOAD:** `{ script_id, slot_id, status, result, error_message, f_flow: 'F-12' }`

**CHAT: chat_message**
- **EVENT:** `chat.message`
- **TRIGGER:** WebSocket
- **TARGET:** CHAT_PANEL
- **PAYLOAD:** `{ slot_id, platform: 'whatsapp' | 'telegram', direction, message_text, f_flow: 'F-09' }`

---

### SCREEN: RBAC

**COMPONENTS:**

**TABLE: roles_table**

**EDIT_BUTTON**
- **EVENT:** `rbac.edit`
- **TRIGGER:** `onClick`
- **TARGET:** `/api/roles/:id`
- **PAYLOAD:** `{ role_id }`

**UPDATE_ROLE**
- **EVENT:** `rbac.update`
- **TRIGGER:** `onSubmit`
- **TARGET:** `/api/roles/:id`
- **PAYLOAD:** `{ role_id, permissions }`
- **SUCCESS:** `rbac.update` → RBAC

---

### SCREEN: SYSTEM_MONITOR

**COMPONENTS:**

**SIP_TRUNK_ROW**
- **EVENT:** `pbx.status.update`
- **TRIGGER:** WebSocket
- **TARGET:** SYSTEM_MONITOR
- **PAYLOAD:** `{ trunk, state, registered_slots, active_calls }`

**USB_HUB_ROW**
- **EVENT:** `usb.status.update`
- **TRIGGER:** WebSocket
- **TARGET:** SYSTEM_MONITOR
- **PAYLOAD:** `{ hub_id, online, total, slots: [{ slot_id, status }] }`

**METRIC_CPU**
- **EVENT:** `system.metric.update`
- **TRIGGER:** WebSocket
- **TARGET:** SYSTEM_MONITOR
- **PAYLOAD:** `{ cpu, ram, disk, network }`

**METRIC_RAM**
- **EVENT:** `system.metric.update`
- **TRIGGER:** WebSocket
- **TARGET:** SYSTEM_MONITOR
- **PAYLOAD:** `{ ram }`

**ALERT: system_alert**
- **EVENT:** `system.alert`
- **TRIGGER:** WebSocket
- **TARGET:** ALERT_PANEL
- **PAYLOAD:** `{ type, severity, message, slot_id, f_flow: 'F-07' }`

---

### SCREEN: NOTIFICATIONS

**COMPONENTS:**

**NOTIFICATION: notification_list**
- **EVENT:** `notification.update`
- **TRIGGER:** WebSocket
- **TARGET:** NOTIFICATION_LIST
- **PAYLOAD:** `{ notification_id, type, severity, message, status, f_flow: 'F-07' }`

**NOTIFICATION: send_notification**
- **EVENT:** `notification.send`
- **TRIGGER:** `onClick`
- **TARGET:** `/api/notifier/send`
- **PAYLOAD:** `{ channel: 'telegram' | 'whatsapp' | 'email', recipient, message }`
- **F-FLOW:** F-07

---

## WebSocket Events Summary

### Control Plane Events (F-01, F-05, F-11)
- `slot.update` - Slot status changes (F-05)
- `call.update` - Call status changes (F-03, F-08)
- `campaign.status` - Campaign updates (F-11)
- `autodial.lead.update` - Lead status (F-01)
- `pipeline.update` - Pipeline status (F-11)

### Media Plane Events (F-03, F-04, F-09, F-10, F-13, F-14)
- `call.start` - Call initiated (F-03)
- `call.end` - Call ended (F-08)
- `rtmp.stream.start` - RTMP stream started (F-04)
- `rtmp.stream.stop` - RTMP stream stopped (F-04)
- `sip.registration` - SIP registration status (F-09)
- `cdr.update` - CDR record updated (F-13)
- `recording.update` - Recording status (F-14)

### Access/Automation Events (F-02, F-12)
- `gacs.execute` - GACS script execution (F-02)
- `gacs.event` - GACS script status (F-12)
- `chat.message` - Chat message received/sent (F-09)

### DRP Events (F-06)
- `slot.reboot` - Slot reboot initiated (F-06)
- `drp.operation` - DRP operation status (F-06)

### Notification Events (F-07)
- `system.alert` - System alert (F-07)
- `notification.update` - Notification status (F-07)

---

## Event Flow Examples

### Example 1: Starting a Call
1. User clicks "START CALL" button → `call.start` event
2. API call to `/api/call/start` with `{ number, slot }`
3. Backend publishes F-03 event to RabbitMQ
4. WebSocket broadcasts `call.update` to all clients
5. Frontend updates CALL_FEED and SLOT_GRID

### Example 2: GACS Script Execution
1. User clicks "EXECUTE GACS" button → `gacs.execute` event
2. API call to `/api/slots/:id/gacs` with `{ script_name, script_type }`
3. Backend publishes F-02 event to RabbitMQ
4. DCI executes script via ADB/SSH
5. WebSocket broadcasts `gacs.event` with status
6. Frontend updates GACS_SCRIPTS panel

### Example 3: Slot Status Update
1. Slot changes FSM state (e.g., IDLE → CALLING)
2. DCI publishes F-05 event to RabbitMQ
3. WORKSPACE service receives event and broadcasts via WebSocket
4. Frontend receives `slot.update` event
5. Dashboard metrics and SLOT_GRID are updated

---

**Версия:** 1.0  
**Дата:** 2025-01-XX

