/**
 * 日期格式化工具
 * @module utils/format
 */

/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param {Date|string} date - 日期对象或日期字符串
 * @returns {string} 格式化后的日期字符串
 */
export function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 格式化货币金额
 * @param {number} amount - 金额
 * @param {string} currency - 货币符号
 * @returns {string} 格式化后的金额字符串
 */
export function formatCurrency(amount, currency = '$') {
  return `${currency}${amount.toFixed(2)}`;
}

/**
 * 格式化电话号码（仅内部使用）
 * @param {string} phone - 电话号码
 * @returns {string} 格式化后的电话号码
 */
export function formatPhone(phone) {
  return phone.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
}

/**
 * 格式化地址
 * @param {Object} address - 地址对象
 * @returns {string} 格式化后的地址
 */
export function formatAddress(address) {
  return `${address.province}${address.city}${address.district}`;
}

const helpers = {
  formatDate,
  formatCurrency,
};

export default helpers;
