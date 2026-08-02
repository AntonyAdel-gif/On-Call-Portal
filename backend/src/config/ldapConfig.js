// src/config/ldapConfig.js
export const ldapConfig = {
  url: process.env.LDAP_URL,
  baseDN: process.env.LDAP_BASE_DN, // e.g. ou=people,dc=company,dc=local
};