import crypto from 'crypto';

export const getClientIP = (request) => {
  return (
    request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    request.headers['x-real-ip'] ||
    request.socket?.remoteAddress ||
    request.ip ||
    'unknown'
  );
};

export const getUserAgent = (request) => {
  return request.headers['user-agent'] || null;
};


export const getDeviceName = (request) => {
  const raw =
    request.body?.device_name ||
    request.headers['x-device-name'] ||
    request.headers['device-name'] ||
    '';

  return String(raw || '').trim();
};

export const getDeviceId = (request) => {
  const raw =
    request.body?.device_id ||
    request.headers['x-device-id'] ||
    request.headers['device-id'] ||
    '';

  return String(raw || '').trim() || crypto.randomUUID();
};


export default {
  getClientIP,
  getUserAgent,
  getDeviceName,
  getDeviceId,
};