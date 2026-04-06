/**
 * RBAC - Role-Based Access Control System
 * Enterprise-grade permission system for multi-tenant SaaS
 * 
 * This module provides centralized permission checking for the frontend.
 * All permission logic should use these helpers to ensure consistency.
 */

/**
 * Check if user can access a specific section
 * @param {Object} user - User object with role and permissions
 * @param {string} section - Section name (e.g., 'settings', 'accounting')
 * @returns {boolean}
 */
export function canAccessSection(user, section) {
  if (!user || !section) return false;
  
  // Check if permissions are available from backend
  if (user.permissions?.sections) {
    return user.permissions.sections[section] === true;
  }
  
  // Fallback: Owner always has access
  if (user.role === 'owner' || user.is_owner === true) return true;
  
  // Fallback: Define base permissions
  const sectionPermissions = {
    dashboard: ['owner', 'admin', 'director', 'coordinator', 'teacher', 'auxiliar'],
    settings: ['owner'],
    accounting: ['owner'], // Admin access is conditional via feature flag
    users: ['owner', 'admin', 'director'],
    grades: ['owner', 'admin', 'director', 'coordinator'],
    courses: ['owner', 'admin', 'director', 'coordinator', 'teacher'],
    attendance: ['owner', 'admin', 'director', 'coordinator', 'teacher', 'auxiliar'],
    discipline: ['owner', 'admin', 'director', 'coordinator', 'teacher', 'auxiliar'],
    pae: ['owner', 'admin', 'auxiliar_alimentacion'],
    reports: ['owner', 'admin', 'director', 'coordinator'],
    schedule: ['owner', 'admin', 'director', 'coordinator'],
    exams: ['owner', 'admin', 'director', 'coordinator', 'teacher'],
    internal_mail: ['owner', 'admin', 'director', 'coordinator', 'teacher', 'auxiliar', 'student', 'parent'],
  };
  
  const allowedRoles = sectionPermissions[section] || [];
  return allowedRoles.includes(user.role);
}

/**
 * Check if user is an owner
 * @param {Object} user - User object
 * @returns {boolean}
 */
export function isOwner(user) {
  return user?.role === 'owner' || user?.is_owner === true;
}

/**
 * Check if user is an admin (not owner)
 * @param {Object} user - User object
 * @returns {boolean}
 */
export function isAdmin(user) {
  return user?.role === 'admin';
}

/**
 * Check if user has admin-level access (owner, admin, director)
 * @param {Object} user - User object
 * @returns {boolean}
 */
export function hasAdminAccess(user) {
  const adminRoles = ['owner', 'admin', 'director', 'coordinator'];
  return adminRoles.includes(user?.role);
}

/**
 * Check if user is staff (not student or parent)
 * @param {Object} user - User object
 * @returns {boolean}
 */
export function isStaff(user) {
  const staffRoles = ['owner', 'admin', 'director', 'coordinator', 'teacher', 'auxiliar', 'auxiliar_alimentacion'];
  return staffRoles.includes(user?.role);
}

/**
 * Get display name for a role
 * @param {string} role - Role identifier
 * @returns {string}
 */
export function getRoleDisplayName(role) {
  const roleNames = {
    owner: 'Propietario',
    admin: 'Administrador',
    director: 'Director',
    coordinator: 'Coordinador',
    teacher: 'Profesor',
    auxiliar: 'Auxiliar',
    auxiliar_alimentacion: 'Auxiliar de Alimentacion',
    student: 'Estudiante',
    parent: 'Padre/Apoderado',
  };
  return roleNames[role] || role;
}

/**
 * Filter navigation items based on user permissions
 * @param {Array} items - Array of navigation items with section property
 * @param {Object} user - User object with permissions
 * @returns {Array} Filtered navigation items
 */
export function filterNavigationByPermissions(items, user) {
  if (!user || !items) return [];
  
  return items.filter(item => {
    // If item doesn't have a section restriction, show it
    if (!item.section) return true;
    
    // Check permission for the section
    return canAccessSection(user, item.section);
  });
}

/**
 * Get all accessible sections for a user
 * @param {Object} user - User object with permissions
 * @returns {Object} Object with section names as keys and boolean access as values
 */
export function getUserSections(user) {
  if (!user) return {};
  
  // Use backend-provided permissions if available
  if (user.permissions?.sections) {
    return user.permissions.sections;
  }
  
  // Fallback: Calculate locally
  const sections = [
    'settings', 'accounting', 'users', 'grades', 'courses',
    'attendance', 'reports', 'schedule', 'exams', 'internal_mail'
  ];
  
  const result = {};
  sections.forEach(section => {
    result[section] = canAccessSection(user, section);
  });
  
  return result;
}

export default {
  canAccessSection,
  isOwner,
  isAdmin,
  hasAdminAccess,
  isStaff,
  getRoleDisplayName,
  filterNavigationByPermissions,
  getUserSections,
};
