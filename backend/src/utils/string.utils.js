const normalizeValue = (val) => {
    if(typeof val !== 'string') return val;

    const cleanedValue = val.replace(/\s+/g, " ");
    
    return cleanedValue.trim().toLowerCase();
}


const RESERVED_WORDS = new Set([
  'admin', 'administrator', 'root', 'system', 'sysadmin', 'superuser',
  'owner', 'master', 'operator', 'dbadmin', 'postmaster', 'hostmaster',
  'support', 'help', 'helpdesk', 'service', 'info', 'contact', 'security',
  'verify', 'verification', 'audit', 'compliance', 'moderator', 'staff',
  'team', 'official', 'billing', 'accounts',
  'api', 'localhost', 'null', 'undefined', 'anonymous', 'guest', 'bot',
  'robot', 'crawler', 'proxy', 'test', 'tester', 'dev', 'developer',
  'staging', 'production', 'internal',
  'legal', 'privacy', 'terms', 'policy', 'tos', 'abuse', 'copyright',
  'trademark', 'claim', 'refund'
]);


export { normalizeValue, RESERVED_WORDS };
export default { normalizeValue, RESERVED_WORDS };