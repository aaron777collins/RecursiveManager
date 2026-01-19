/**
 * Mock for execa module to avoid ESM import issues in Jest
 */

const execa = jest.fn();
execa.sync = jest.fn();
execa.command = jest.fn();
execa.commandSync = jest.fn();
execa.node = jest.fn();

module.exports = { execa };
module.exports.execa = execa;
module.exports.default = execa;
