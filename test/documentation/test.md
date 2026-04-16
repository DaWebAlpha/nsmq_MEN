# JEST

## TEST FOR config JEST

```javascript
     npm test
```

## add to package.json

 ```javascript
"test": "node --experimental-vm-modules node_modules/jest/bin/jest.js",
 ```

## CREATE jest.config.js

```javascript
export default {
  testEnvironment: "node",
  transform: {},
  moduleNameMapper: {
     "^@backend/(.*)$": "<rootDir>/backend/$1"
  }
};
```
