// The native part is an Expo module, linked by Expo's autolinking. Without Expo the library still
// works (from React Native's measurements), so the React Native CLI must not link it.
module.exports = { dependency: { platforms: { ios: null, android: null } } };
