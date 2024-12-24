const { z } = require('zod');

const candidateValidationSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    party: z.string().min(1, 'Party name is required'), 
    age: z.number().min(25, 'Candidate must be at least 25 years old').max(75, 'Candidate age must be below 75'),
});



const updateCandidateSchema = z.object({
    name: z.string().min(1, "Name must be at least 1 character").optional(),
    party: z.string().min(1, "Party must be at least 1 character").optional(),
    age: z.number().int().positive("Age must be a positive integer").optional(),
  });
  


module.exports = {candidateValidationSchema, updateCandidateSchema};
