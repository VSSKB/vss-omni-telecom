/**
 * Input validation schemas for VSS services
 * Uses Joi for validation
 */

const Joi = require('joi');

// Phone number validation (international format)
const phoneNumberSchema = Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .messages({
        'string.pattern.base': 'Phone number must be in E.164 format (+1234567890)'
    });

// Email validation
const emailSchema = Joi.string().email().max(255);

// UUID validation
const uuidSchema = Joi.string().uuid();

// IP address validation
const ipAddressSchema = Joi.string().ip({
    version: ['ipv4', 'ipv6']
});

// Port validation
const portSchema = Joi.number().integer().min(1).max(65535);

// ============================================
// CRM Schemas
// ============================================

const createLeadSchema = Joi.object({
    phone_number: phoneNumberSchema.required(),
    name: Joi.string().max(255),
    email: emailSchema,
    company: Joi.string().max(255),
    lead_data: Joi.object(),
    status: Joi.string().valid('new', 'contacted', 'qualified', 'converted', 'lost'),
    assigned_seller: Joi.number().integer().positive()
});

const createNoteSchema = Joi.object({
    call_id: Joi.number().integer().positive().required(),
    lead_id: Joi.number().integer().positive(),
    note_text: Joi.string().max(2000).required(),
    note_type: Joi.string().valid('call', 'email', 'meeting', 'other')
});

// ============================================
// Call/Slot Schemas
// ============================================

const startCallSchema = Joi.object({
    slot_id: Joi.number().integer().positive().required(),
    phone_number: phoneNumberSchema.required(),
    caller_id: phoneNumberSchema,
    direction: Joi.string().valid('inbound', 'outbound').default('outbound'),
    campaign_id: Joi.number().integer().positive(),
    lead_id: Joi.number().integer().positive()
});

const endCallSchema = Joi.object({
    call_id: Joi.number().integer().positive().required(),
    hangup_reason: Joi.string().max(255)
});

const slotActionSchema = Joi.object({
    slot_id: Joi.number().integer().positive().required(),
    action: Joi.string().valid('restart', 'reboot', 'stop', 'start').required()
});

// ============================================
// Auth Schemas
// ============================================

const loginSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(6).max(128).required()
});

const registerSchema = Joi.object({
    username: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(8).max(128).required(),
    email: emailSchema.required(),
    role: Joi.string().valid('admin', 'operator', 'seller', 'supervisor').default('operator')
});

// ============================================
// Autodialer Schemas
// ============================================

const runCampaignSchema = Joi.object({
    campaign_id: Joi.string().max(255).required(),
    name: Joi.string().max(255).required(),
    leads: Joi.array().items(Joi.object({
        phone_number: phoneNumberSchema.required(),
        lead_data: Joi.object()
    })).min(1).max(10000).required(),
    slot_ids: Joi.array().items(Joi.number().integer().positive()).min(1),
    max_concurrent: Joi.number().integer().min(1).max(100).default(10),
    retry_failed: Joi.boolean().default(false)
});

// ============================================
// GACS Schemas  
// ============================================

const gacsScriptSchema = Joi.object({
    script_name: Joi.string().max(255).required(),
    script_type: Joi.string().valid('adb', 'ssh', 'shell').required(),
    script_content: Joi.string().max(10000).required(),
    slot_id: Joi.number().integer().positive()
});

// ============================================
// Validation middleware factory
// ============================================

/**
 * Creates validation middleware for Express
 * @param {Joi.Schema} schema - Joi validation schema
 * @param {string} property - Property to validate ('body', 'query', 'params')
 * @returns {Function} - Express middleware
 */
function validate(schema, property = 'body') {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[property], {
            abortEarly: false, // Return all errors
            stripUnknown: true // Remove unknown fields
        });
        
        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                type: detail.type
            }));
            
            return res.status(400).json({
                error: true,
                code: 'VALIDATION_ERROR',
                message: 'Invalid input data',
                validation_errors: errors
            });
        }
        
        // Replace req[property] with validated value (sanitized)
        req[property] = value;
        next();
    };
}

module.exports = {
    // Schemas
    phoneNumberSchema,
    emailSchema,
    uuidSchema,
    ipAddressSchema,
    portSchema,
    createLeadSchema,
    createNoteSchema,
    startCallSchema,
    endCallSchema,
    slotActionSchema,
    loginSchema,
    registerSchema,
    runCampaignSchema,
    gacsScriptSchema,
    
    // Middleware
    validate
};

