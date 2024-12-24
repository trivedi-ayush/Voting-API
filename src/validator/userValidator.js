const { z } = require('zod');


const userValidationSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    age: z.number().min(18, 'Age must be at least 18').max(100, 'Age must be less than 100'),
    email: z.string().email('Invalid email format').optional(),
    mobile: z.string().regex(/^\d{10}$/, 'Invalid mobile number').optional(),
    address: z.string().min(1, 'Address is required'),
    aadharCardNumber: z.number().int().positive().refine(value => value.toString().length === 12, {
        message: 'Aadhar card number must be 12 digits',
    }),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    role: z.enum(['voter', 'admin']).default('voter'),
    isVoted: z.boolean().default(false),
});

module.exports = userValidationSchema
