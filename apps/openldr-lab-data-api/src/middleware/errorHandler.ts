import express from "express";

// Error handling middleware
export const errorHandler = (err:any, req:express.Request, res:express.Response, next:express.NextFunction) => {
  console.error('Error:', err);
    
  // Default error
  let error = {
    error: 'Internal Server Error',
    message: err.message || 'Something went wrong',
    status_code: 500,
    timestamp: new Date().toISOString()
  };

  // Handle specific error types
  if (err.name === 'ValidationError') {
    error = {
      error: 'Validation Error',
      message: err.message,
      status_code: 400,
      timestamp: new Date().toISOString()
    };
  } else if (err.name === 'UnauthorizedError') {
    error = {
      error: 'Unauthorized',
      message: 'Invalid or missing authentication token',
      status_code: 401,
      timestamp: new Date().toISOString()
    };
  } else if (err.code === '23505') { // PostgreSQL unique constraint violation
    error = {
      error: 'Duplicate Entry',
      message: 'A record with this identifier already exists',
      status_code: 409,
      timestamp: new Date().toISOString()
    };
  } else if (err.code === '23503') { // PostgreSQL foreign key constraint violation
    error = {
      error: 'Reference Error',
      message: 'Referenced record does not exist',
      status_code: 400,
      timestamp: new Date().toISOString()
    };
  } else if (err.code === '42P01') { // PostgreSQL undefined table
    error = {
      error: 'Database Error',
      message: 'Required database table does not exist',
      status_code: 500,
      timestamp: new Date().toISOString()
    };
  }

  res.status(error.status_code).json(error);
};