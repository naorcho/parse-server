"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ParseGraphQLSchema = void 0;

var _node = _interopRequireDefault(require("parse/node"));

var _graphql = require("graphql");

var _graphqlTools = require("graphql-tools");

var _requiredParameter = _interopRequireDefault(require("../requiredParameter"));

var defaultGraphQLTypes = _interopRequireWildcard(require("./loaders/defaultGraphQLTypes"));

var parseClassTypes = _interopRequireWildcard(require("./loaders/parseClassTypes"));

var parseClassQueries = _interopRequireWildcard(require("./loaders/parseClassQueries"));

var parseClassMutations = _interopRequireWildcard(require("./loaders/parseClassMutations"));

var defaultGraphQLQueries = _interopRequireWildcard(require("./loaders/defaultGraphQLQueries"));

var defaultGraphQLMutations = _interopRequireWildcard(require("./loaders/defaultGraphQLMutations"));

var _ParseGraphQLController = _interopRequireWildcard(require("../Controllers/ParseGraphQLController"));

var _DatabaseController = _interopRequireDefault(require("../Controllers/DatabaseController"));

var _parseGraphQLUtils = require("./parseGraphQLUtils");

var schemaDirectives = _interopRequireWildcard(require("./loaders/schemaDirectives"));

var schemaTypes = _interopRequireWildcard(require("./loaders/schemaTypes"));

var _triggers = require("../triggers");

var defaultRelaySchema = _interopRequireWildcard(require("./loaders/defaultRelaySchema"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function () { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || typeof obj !== "object" && typeof obj !== "function") { return { default: obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj.default = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const RESERVED_GRAPHQL_TYPE_NAMES = ['String', 'Boolean', 'Int', 'Float', 'ID', 'ArrayResult', 'Query', 'Mutation', 'Subscription', 'CreateFileInput', 'CreateFilePayload', 'Viewer', 'SignUpInput', 'SignUpPayload', 'LogInInput', 'LogInPayload', 'LogOutInput', 'LogOutPayload', 'CloudCodeFunction', 'CallCloudCodeInput', 'CallCloudCodePayload', 'CreateClassInput', 'CreateClassPayload', 'UpdateClassInput', 'UpdateClassPayload', 'DeleteClassInput', 'DeleteClassPayload', 'PageInfo'];
const RESERVED_GRAPHQL_QUERY_NAMES = ['health', 'viewer', 'class', 'classes'];
const RESERVED_GRAPHQL_MUTATION_NAMES = ['signUp', 'logIn', 'logOut', 'createFile', 'callCloudCode', 'createClass', 'updateClass', 'deleteClass'];

class ParseGraphQLSchema {
  constructor(params = {}) {
    this.parseGraphQLController = params.parseGraphQLController || (0, _requiredParameter.default)('You must provide a parseGraphQLController instance!');
    this.databaseController = params.databaseController || (0, _requiredParameter.default)('You must provide a databaseController instance!');
    this.log = params.log || (0, _requiredParameter.default)('You must provide a log instance!');
    this.graphQLCustomTypeDefs = params.graphQLCustomTypeDefs;
    this.appId = params.appId || (0, _requiredParameter.default)('You must provide the appId!');
  }

  async load() {
    const {
      parseGraphQLConfig
    } = await this._initializeSchemaAndConfig();
    const parseClasses = await this._getClassesForSchema(parseGraphQLConfig);
    const parseClassesString = JSON.stringify(parseClasses);
    const functionNames = await this._getFunctionNames();
    const functionNamesString = JSON.stringify(functionNames);

    if (this.graphQLSchema && !this._hasSchemaInputChanged({
      parseClasses,
      parseClassesString,
      parseGraphQLConfig,
      functionNamesString
    })) {
      return this.graphQLSchema;
    }

    this.parseClasses = parseClasses;
    this.parseClassesString = parseClassesString;
    this.parseGraphQLConfig = parseGraphQLConfig;
    this.functionNames = functionNames;
    this.functionNamesString = functionNamesString;
    this.parseClassTypes = {};
    this.viewerType = null;
    this.graphQLAutoSchema = null;
    this.graphQLSchema = null;
    this.graphQLTypes = [];
    this.graphQLQueries = {};
    this.graphQLMutations = {};
    this.graphQLSubscriptions = {};
    this.graphQLSchemaDirectivesDefinitions = null;
    this.graphQLSchemaDirectives = {};
    this.relayNodeInterface = null;
    defaultGraphQLTypes.load(this);
    defaultRelaySchema.load(this);
    schemaTypes.load(this);

    this._getParseClassesWithConfig(parseClasses, parseGraphQLConfig).forEach(([parseClass, parseClassConfig]) => {
      parseClassTypes.load(this, parseClass, parseClassConfig);
      parseClassQueries.load(this, parseClass, parseClassConfig);
      parseClassMutations.load(this, parseClass, parseClassConfig);
    });

    defaultGraphQLTypes.loadArrayResult(this, parseClasses);
    defaultGraphQLQueries.load(this);
    defaultGraphQLMutations.load(this);
    let graphQLQuery = undefined;

    if (Object.keys(this.graphQLQueries).length > 0) {
      graphQLQuery = new _graphql.GraphQLObjectType({
        name: 'Query',
        description: 'Query is the top level type for queries.',
        fields: this.graphQLQueries
      });
      this.addGraphQLType(graphQLQuery, true, true);
    }

    let graphQLMutation = undefined;

    if (Object.keys(this.graphQLMutations).length > 0) {
      graphQLMutation = new _graphql.GraphQLObjectType({
        name: 'Mutation',
        description: 'Mutation is the top level type for mutations.',
        fields: this.graphQLMutations
      });
      this.addGraphQLType(graphQLMutation, true, true);
    }

    let graphQLSubscription = undefined;

    if (Object.keys(this.graphQLSubscriptions).length > 0) {
      graphQLSubscription = new _graphql.GraphQLObjectType({
        name: 'Subscription',
        description: 'Subscription is the top level type for subscriptions.',
        fields: this.graphQLSubscriptions
      });
      this.addGraphQLType(graphQLSubscription, true, true);
    }

    this.graphQLAutoSchema = new _graphql.GraphQLSchema({
      types: this.graphQLTypes,
      query: graphQLQuery,
      mutation: graphQLMutation,
      subscription: graphQLSubscription
    });

    if (this.graphQLCustomTypeDefs) {
      schemaDirectives.load(this);

      if (typeof this.graphQLCustomTypeDefs.getTypeMap === 'function') {
        const customGraphQLSchemaTypeMap = this.graphQLCustomTypeDefs.getTypeMap();
        Object.values(customGraphQLSchemaTypeMap).forEach(customGraphQLSchemaType => {
          if (!customGraphQLSchemaType || !customGraphQLSchemaType.name || customGraphQLSchemaType.name.startsWith('__')) {
            return;
          }

          const autoGraphQLSchemaType = this.graphQLAutoSchema.getType(customGraphQLSchemaType.name);

          if (autoGraphQLSchemaType && typeof customGraphQLSchemaType.getFields === 'function') {
            const findAndReplaceLastType = (parent, key) => {
              if (parent[key].name) {
                if (this.graphQLAutoSchema.getType(parent[key].name) && this.graphQLAutoSchema.getType(parent[key].name) !== parent[key]) {
                  // To avoid unresolved field on overloaded schema
                  // replace the final type with the auto schema one
                  parent[key] = this.graphQLAutoSchema.getType(parent[key].name);
                }
              } else {
                if (parent[key].ofType) {
                  findAndReplaceLastType(parent[key], 'ofType');
                }
              }
            };

            Object.values(customGraphQLSchemaType.getFields()).forEach(field => {
              findAndReplaceLastType(field, 'type');
            });
            autoGraphQLSchemaType._fields = _objectSpread(_objectSpread({}, autoGraphQLSchemaType.getFields()), customGraphQLSchemaType.getFields());
          } else {
            this.graphQLAutoSchema._typeMap[customGraphQLSchemaType.name] = customGraphQLSchemaType;
          }
        });
        this.graphQLSchema = (0, _graphqlTools.mergeSchemas)({
          schemas: [this.graphQLSchemaDirectivesDefinitions, this.graphQLAutoSchema],
          mergeDirectives: true
        });
      } else if (typeof this.graphQLCustomTypeDefs === 'function') {
        this.graphQLSchema = await this.graphQLCustomTypeDefs({
          directivesDefinitionsSchema: this.graphQLSchemaDirectivesDefinitions,
          autoSchema: this.graphQLAutoSchema,
          mergeSchemas: _graphqlTools.mergeSchemas
        });
      } else {
        this.graphQLSchema = (0, _graphqlTools.mergeSchemas)({
          schemas: [this.graphQLSchemaDirectivesDefinitions, this.graphQLAutoSchema, this.graphQLCustomTypeDefs],
          mergeDirectives: true
        });
      }

      const graphQLSchemaTypeMap = this.graphQLSchema.getTypeMap();
      Object.keys(graphQLSchemaTypeMap).forEach(graphQLSchemaTypeName => {
        const graphQLSchemaType = graphQLSchemaTypeMap[graphQLSchemaTypeName];

        if (typeof graphQLSchemaType.getFields === 'function' && this.graphQLCustomTypeDefs.definitions) {
          const graphQLCustomTypeDef = this.graphQLCustomTypeDefs.definitions.find(definition => definition.name.value === graphQLSchemaTypeName);

          if (graphQLCustomTypeDef) {
            const graphQLSchemaTypeFieldMap = graphQLSchemaType.getFields();
            Object.keys(graphQLSchemaTypeFieldMap).forEach(graphQLSchemaTypeFieldName => {
              const graphQLSchemaTypeField = graphQLSchemaTypeFieldMap[graphQLSchemaTypeFieldName];

              if (!graphQLSchemaTypeField.astNode) {
                const astNode = graphQLCustomTypeDef.fields.find(field => field.name.value === graphQLSchemaTypeFieldName);

                if (astNode) {
                  graphQLSchemaTypeField.astNode = astNode;
                }
              }
            });
          }
        }
      });

      _graphqlTools.SchemaDirectiveVisitor.visitSchemaDirectives(this.graphQLSchema, this.graphQLSchemaDirectives);
    } else {
      this.graphQLSchema = this.graphQLAutoSchema;
    }

    return this.graphQLSchema;
  }

  addGraphQLType(type, throwError = false, ignoreReserved = false, ignoreConnection = false) {
    if (!ignoreReserved && RESERVED_GRAPHQL_TYPE_NAMES.includes(type.name) || this.graphQLTypes.find(existingType => existingType.name === type.name) || !ignoreConnection && type.name.endsWith('Connection')) {
      const message = `Type ${type.name} could not be added to the auto schema because it collided with an existing type.`;

      if (throwError) {
        throw new Error(message);
      }

      this.log.warn(message);
      return undefined;
    }

    this.graphQLTypes.push(type);
    return type;
  }

  addGraphQLQuery(fieldName, field, throwError = false, ignoreReserved = false) {
    if (!ignoreReserved && RESERVED_GRAPHQL_QUERY_NAMES.includes(fieldName) || this.graphQLQueries[fieldName]) {
      const message = `Query ${fieldName} could not be added to the auto schema because it collided with an existing field.`;

      if (throwError) {
        throw new Error(message);
      }

      this.log.warn(message);
      return undefined;
    }

    this.graphQLQueries[fieldName] = field;
    return field;
  }

  addGraphQLMutation(fieldName, field, throwError = false, ignoreReserved = false) {
    if (!ignoreReserved && RESERVED_GRAPHQL_MUTATION_NAMES.includes(fieldName) || this.graphQLMutations[fieldName]) {
      const message = `Mutation ${fieldName} could not be added to the auto schema because it collided with an existing field.`;

      if (throwError) {
        throw new Error(message);
      }

      this.log.warn(message);
      return undefined;
    }

    this.graphQLMutations[fieldName] = field;
    return field;
  }

  handleError(error) {
    if (error instanceof _node.default.Error) {
      this.log.error('Parse error: ', error);
    } else {
      this.log.error('Uncaught internal server error.', error, error.stack);
    }

    throw (0, _parseGraphQLUtils.toGraphQLError)(error);
  }

  async _initializeSchemaAndConfig() {
    const [schemaController, parseGraphQLConfig] = await Promise.all([this.databaseController.loadSchema(), this.parseGraphQLController.getGraphQLConfig()]);
    this.schemaController = schemaController;
    return {
      parseGraphQLConfig
    };
  }
  /**
   * Gets all classes found by the `schemaController`
   * minus those filtered out by the app's parseGraphQLConfig.
   */


  async _getClassesForSchema(parseGraphQLConfig) {
    const {
      enabledForClasses,
      disabledForClasses
    } = parseGraphQLConfig;
    const allClasses = await this.schemaController.getAllClasses();

    if (Array.isArray(enabledForClasses) || Array.isArray(disabledForClasses)) {
      let includedClasses = allClasses;

      if (enabledForClasses) {
        includedClasses = allClasses.filter(clazz => {
          return enabledForClasses.includes(clazz.className);
        });
      }

      if (disabledForClasses) {
        // Classes included in `enabledForClasses` that
        // are also present in `disabledForClasses` will
        // still be filtered out
        includedClasses = includedClasses.filter(clazz => {
          return !disabledForClasses.includes(clazz.className);
        });
      }

      this.isUsersClassDisabled = !includedClasses.some(clazz => {
        return clazz.className === '_User';
      });
      return includedClasses;
    } else {
      return allClasses;
    }
  }
  /**
   * This method returns a list of tuples
   * that provide the parseClass along with
   * its parseClassConfig where provided.
   */


  _getParseClassesWithConfig(parseClasses, parseGraphQLConfig) {
    const {
      classConfigs
    } = parseGraphQLConfig; // Make sures that the default classes and classes that
    // starts with capitalized letter will be generated first.

    const sortClasses = (a, b) => {
      a = a.className;
      b = b.className;

      if (a[0] === '_') {
        if (b[0] !== '_') {
          return -1;
        }
      }

      if (b[0] === '_') {
        if (a[0] !== '_') {
          return 1;
        }
      }

      if (a === b) {
        return 0;
      } else if (a < b) {
        return -1;
      } else {
        return 1;
      }
    };

    return parseClasses.sort(sortClasses).map(parseClass => {
      let parseClassConfig;

      if (classConfigs) {
        parseClassConfig = classConfigs.find(c => c.className === parseClass.className);
      }

      return [parseClass, parseClassConfig];
    });
  }

  async _getFunctionNames() {
    return await (0, _triggers.getFunctionNames)(this.appId).filter(functionName => {
      if (/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(functionName)) {
        return true;
      } else {
        this.log.warn(`Function ${functionName} could not be added to the auto schema because GraphQL names must match /^[_a-zA-Z][_a-zA-Z0-9]*$/.`);
        return false;
      }
    });
  }
  /**
   * Checks for changes to the parseClasses
   * objects (i.e. database schema) or to
   * the parseGraphQLConfig object. If no
   * changes are found, return true;
   */


  _hasSchemaInputChanged(params) {
    const {
      parseClasses,
      parseClassesString,
      parseGraphQLConfig,
      functionNamesString
    } = params;

    if (JSON.stringify(this.parseGraphQLConfig) === JSON.stringify(parseGraphQLConfig) && this.functionNamesString === functionNamesString) {
      if (this.parseClasses === parseClasses) {
        return false;
      }

      if (this.parseClassesString === parseClassesString) {
        this.parseClasses = parseClasses;
        return false;
      }
    }

    return true;
  }

}

exports.ParseGraphQLSchema = ParseGraphQLSchema;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uL3NyYy9HcmFwaFFML1BhcnNlR3JhcGhRTFNjaGVtYS5qcyJdLCJuYW1lcyI6WyJSRVNFUlZFRF9HUkFQSFFMX1RZUEVfTkFNRVMiLCJSRVNFUlZFRF9HUkFQSFFMX1FVRVJZX05BTUVTIiwiUkVTRVJWRURfR1JBUEhRTF9NVVRBVElPTl9OQU1FUyIsIlBhcnNlR3JhcGhRTFNjaGVtYSIsImNvbnN0cnVjdG9yIiwicGFyYW1zIiwicGFyc2VHcmFwaFFMQ29udHJvbGxlciIsImRhdGFiYXNlQ29udHJvbGxlciIsImxvZyIsImdyYXBoUUxDdXN0b21UeXBlRGVmcyIsImFwcElkIiwibG9hZCIsInBhcnNlR3JhcGhRTENvbmZpZyIsIl9pbml0aWFsaXplU2NoZW1hQW5kQ29uZmlnIiwicGFyc2VDbGFzc2VzIiwiX2dldENsYXNzZXNGb3JTY2hlbWEiLCJwYXJzZUNsYXNzZXNTdHJpbmciLCJKU09OIiwic3RyaW5naWZ5IiwiZnVuY3Rpb25OYW1lcyIsIl9nZXRGdW5jdGlvbk5hbWVzIiwiZnVuY3Rpb25OYW1lc1N0cmluZyIsImdyYXBoUUxTY2hlbWEiLCJfaGFzU2NoZW1hSW5wdXRDaGFuZ2VkIiwicGFyc2VDbGFzc1R5cGVzIiwidmlld2VyVHlwZSIsImdyYXBoUUxBdXRvU2NoZW1hIiwiZ3JhcGhRTFR5cGVzIiwiZ3JhcGhRTFF1ZXJpZXMiLCJncmFwaFFMTXV0YXRpb25zIiwiZ3JhcGhRTFN1YnNjcmlwdGlvbnMiLCJncmFwaFFMU2NoZW1hRGlyZWN0aXZlc0RlZmluaXRpb25zIiwiZ3JhcGhRTFNjaGVtYURpcmVjdGl2ZXMiLCJyZWxheU5vZGVJbnRlcmZhY2UiLCJkZWZhdWx0R3JhcGhRTFR5cGVzIiwiZGVmYXVsdFJlbGF5U2NoZW1hIiwic2NoZW1hVHlwZXMiLCJfZ2V0UGFyc2VDbGFzc2VzV2l0aENvbmZpZyIsImZvckVhY2giLCJwYXJzZUNsYXNzIiwicGFyc2VDbGFzc0NvbmZpZyIsInBhcnNlQ2xhc3NRdWVyaWVzIiwicGFyc2VDbGFzc011dGF0aW9ucyIsImxvYWRBcnJheVJlc3VsdCIsImRlZmF1bHRHcmFwaFFMUXVlcmllcyIsImRlZmF1bHRHcmFwaFFMTXV0YXRpb25zIiwiZ3JhcGhRTFF1ZXJ5IiwidW5kZWZpbmVkIiwiT2JqZWN0Iiwia2V5cyIsImxlbmd0aCIsIkdyYXBoUUxPYmplY3RUeXBlIiwibmFtZSIsImRlc2NyaXB0aW9uIiwiZmllbGRzIiwiYWRkR3JhcGhRTFR5cGUiLCJncmFwaFFMTXV0YXRpb24iLCJncmFwaFFMU3Vic2NyaXB0aW9uIiwiR3JhcGhRTFNjaGVtYSIsInR5cGVzIiwicXVlcnkiLCJtdXRhdGlvbiIsInN1YnNjcmlwdGlvbiIsInNjaGVtYURpcmVjdGl2ZXMiLCJnZXRUeXBlTWFwIiwiY3VzdG9tR3JhcGhRTFNjaGVtYVR5cGVNYXAiLCJ2YWx1ZXMiLCJjdXN0b21HcmFwaFFMU2NoZW1hVHlwZSIsInN0YXJ0c1dpdGgiLCJhdXRvR3JhcGhRTFNjaGVtYVR5cGUiLCJnZXRUeXBlIiwiZ2V0RmllbGRzIiwiZmluZEFuZFJlcGxhY2VMYXN0VHlwZSIsInBhcmVudCIsImtleSIsIm9mVHlwZSIsImZpZWxkIiwiX2ZpZWxkcyIsIl90eXBlTWFwIiwic2NoZW1hcyIsIm1lcmdlRGlyZWN0aXZlcyIsImRpcmVjdGl2ZXNEZWZpbml0aW9uc1NjaGVtYSIsImF1dG9TY2hlbWEiLCJtZXJnZVNjaGVtYXMiLCJncmFwaFFMU2NoZW1hVHlwZU1hcCIsImdyYXBoUUxTY2hlbWFUeXBlTmFtZSIsImdyYXBoUUxTY2hlbWFUeXBlIiwiZGVmaW5pdGlvbnMiLCJncmFwaFFMQ3VzdG9tVHlwZURlZiIsImZpbmQiLCJkZWZpbml0aW9uIiwidmFsdWUiLCJncmFwaFFMU2NoZW1hVHlwZUZpZWxkTWFwIiwiZ3JhcGhRTFNjaGVtYVR5cGVGaWVsZE5hbWUiLCJncmFwaFFMU2NoZW1hVHlwZUZpZWxkIiwiYXN0Tm9kZSIsIlNjaGVtYURpcmVjdGl2ZVZpc2l0b3IiLCJ2aXNpdFNjaGVtYURpcmVjdGl2ZXMiLCJ0eXBlIiwidGhyb3dFcnJvciIsImlnbm9yZVJlc2VydmVkIiwiaWdub3JlQ29ubmVjdGlvbiIsImluY2x1ZGVzIiwiZXhpc3RpbmdUeXBlIiwiZW5kc1dpdGgiLCJtZXNzYWdlIiwiRXJyb3IiLCJ3YXJuIiwicHVzaCIsImFkZEdyYXBoUUxRdWVyeSIsImZpZWxkTmFtZSIsImFkZEdyYXBoUUxNdXRhdGlvbiIsImhhbmRsZUVycm9yIiwiZXJyb3IiLCJQYXJzZSIsInN0YWNrIiwic2NoZW1hQ29udHJvbGxlciIsIlByb21pc2UiLCJhbGwiLCJsb2FkU2NoZW1hIiwiZ2V0R3JhcGhRTENvbmZpZyIsImVuYWJsZWRGb3JDbGFzc2VzIiwiZGlzYWJsZWRGb3JDbGFzc2VzIiwiYWxsQ2xhc3NlcyIsImdldEFsbENsYXNzZXMiLCJBcnJheSIsImlzQXJyYXkiLCJpbmNsdWRlZENsYXNzZXMiLCJmaWx0ZXIiLCJjbGF6eiIsImNsYXNzTmFtZSIsImlzVXNlcnNDbGFzc0Rpc2FibGVkIiwic29tZSIsImNsYXNzQ29uZmlncyIsInNvcnRDbGFzc2VzIiwiYSIsImIiLCJzb3J0IiwibWFwIiwiYyIsImZ1bmN0aW9uTmFtZSIsInRlc3QiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTs7QUFDQTs7QUFNQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFHQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7QUFDQTs7Ozs7Ozs7Ozs7Ozs7QUFFQSxNQUFNQSwyQkFBMkIsR0FBRyxDQUNsQyxRQURrQyxFQUVsQyxTQUZrQyxFQUdsQyxLQUhrQyxFQUlsQyxPQUprQyxFQUtsQyxJQUxrQyxFQU1sQyxhQU5rQyxFQU9sQyxPQVBrQyxFQVFsQyxVQVJrQyxFQVNsQyxjQVRrQyxFQVVsQyxpQkFWa0MsRUFXbEMsbUJBWGtDLEVBWWxDLFFBWmtDLEVBYWxDLGFBYmtDLEVBY2xDLGVBZGtDLEVBZWxDLFlBZmtDLEVBZ0JsQyxjQWhCa0MsRUFpQmxDLGFBakJrQyxFQWtCbEMsZUFsQmtDLEVBbUJsQyxt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QUFMLEdBQW9CQSxZQUFwQjtBQUNBLGVBQU8sS0FBUDtBQUNEO0FBQ0Y7O0FBRUQsV0FBTyxJQUFQO0FBQ0Q7O0FBcGRzQiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBQYXJzZSBmcm9tICdwYXJzZS9ub2RlJztcbmltcG9ydCB7XG4gIEdyYXBoUUxTY2hlbWEsXG4gIEdyYXBoUUxPYmplY3RUeXBlLFxuICBEb2N1bWVudE5vZGUsXG4gIEdyYXBoUUxOYW1lZFR5cGUsXG59IGZyb20gJ2dyYXBocWwnO1xuaW1wb3J0IHsgbWVyZ2VTY2hlbWFzLCBTY2hlbWFEaXJlY3RpdmVWaXNpdG9yIH0gZnJvbSAnZ3JhcGhxbC10b29scyc7XG5pbXBvcnQgcmVxdWlyZWRQYXJhbWV0ZXIgZnJvbSAnLi4vcmVxdWlyZWRQYXJhbWV0ZXInO1xuaW1wb3J0ICogYXMgZGVmYXVsdEdyYXBoUUxUeXBlcyBmcm9tICcuL2xvYWRlcnMvZGVmYXVsdEdyYXBoUUxUeXBlcyc7XG5pbXBvcnQgKiBhcyBwYXJzZUNsYXNzVHlwZXMgZnJvbSAnLi9sb2FkZXJzL3BhcnNlQ2xhc3NUeXBlcyc7XG5pbXBvcnQgKiBhcyBwYXJzZUNsYXNzUXVlcmllcyBmcm9tICcuL2xvYWRlcnMvcGFyc2VDbGFzc1F1ZXJpZXMnO1xuaW1wb3J0ICogYXMgcGFyc2VDbGFzc011dGF0aW9ucyBmcm9tICcuL2xvYWRlcnMvcGFyc2VDbGFzc011dGF0aW9ucyc7XG5pbXBvcnQgKiBhcyBkZWZhdWx0R3JhcGhRTFF1ZXJpZXMgZnJvbSAnLi9sb2FkZXJzL2RlZmF1bHRHcmFwaFFMUXVlcmllcyc7XG5pbXBvcnQgKiBhcyBkZWZhdWx0R3JhcGhRTE11dGF0aW9ucyBmcm9tICcuL2xvYWRlcnMvZGVmYXVsdEdyYXBoUUxNdXRhdGlvbnMnO1xuaW1wb3J0IFBhcnNlR3JhcGhRTENvbnRyb2xsZXIsIHtcbiAgUGFyc2VHcmFwaFFMQ29uZmlnLFxufSBmcm9tICcuLi9Db250cm9sbGVycy9QYXJzZUdyYXBoUUxDb250cm9sbGVyJztcbmltcG9ydCBEYXRhYmFzZUNvbnRyb2xsZXIgZnJvbSAnLi4vQ29udHJvbGxlcnMvRGF0YWJhc2VDb250cm9sbGVyJztcbmltcG9ydCB7IHRvR3JhcGhRTEVycm9yIH0gZnJvbSAnLi9wYXJzZUdyYXBoUUxVdGlscyc7XG5pbXBvcnQgKiBhcyBzY2hlbWFEaXJlY3RpdmVzIGZyb20gJy4vbG9hZGVycy9zY2hlbWFEaXJlY3RpdmVzJztcbmltcG9ydCAqIGFzIHNjaGVtYVR5cGVzIGZyb20gJy4vbG9hZGVycy9zY2hlbWFUeXBlcyc7XG5pbXBvcnQgeyBnZXRGdW5jdGlvbk5hbWVzIH0gZnJvbSAnLi4vdHJpZ2dlcnMnO1xuaW1wb3J0ICogYXMgZGVmYXVsdFJlbGF5U2NoZW1hIGZyb20gJy4vbG9hZGVycy9kZWZhdWx0UmVsYXlTY2hlbWEnO1xuXG5jb25zdCBSRVNFUlZFRF9HUkFQSFFMX1RZUEVfTkFNRVMgPSBbXG4gICdTdHJpbmcnLFxuICAnQm9vbGVhbicsXG4gICdJbnQnLFxuICAnRmxvYXQnLFxuICAnSUQnLFxuICAnQXJyYXlSZXN1bHQnLFxuICAnUXVlcnknLFxuICAnTXV0YXRpb24nLFxuICAnU3Vic2NyaXB0aW9uJyxcbiAgJ0NyZWF0ZUZpbGVJbnB1dCcsXG4gICdDcmVhdGVGaWxlUGF5bG9hZCcsXG4gICdWaWV3ZXInLFxuICAnU2lnblVwSW5wdXQnLFxuICAnU2lnblVwUGF5bG9hZCcsXG4gICdMb2dJbklucHV0JyxcbiAgJ0xvZ0luUGF5bG9hZCcsXG4gICdMb2dPdXRJbnB1dCcsXG4gICdMb2dPdXRQYXlsb2FkJyxcbiAgJ0Nsb3VkQ29kZUZ1bmN0aW9uJyxcbiAgJ0NhbGxDbG91ZENvZGVJbnB1dCcsXG4gICdDYWxsQ2xvdWRDb2RlUGF5bG9hZCcsXG4gICdDcmVhdGVDbGFzc0lucHV0JyxcbiAgJ0NyZWF0ZUNsYXNzUGF5bG9hZCcsXG4gICdVcGRhdGVDbGFzc0lucHV0JyxcbiAgJ1VwZGF0ZUNsYXNzUGF5bG9hZCcsXG4gICdEZWxldGVDbGFzc0lucHV0JyxcbiAgJ0RlbGV0ZUNsYXNzUGF5bG9hZCcsXG4gICdQYWdlSW5mbycsXG5dO1xuY29uc3QgUkVTRVJWRURfR1JBUEhRTF9RVUVSWV9OQU1FUyA9IFsnaGVhbHRoJywgJ3ZpZXdlcicsICdjbGFzcycsICdjbGFzc2VzJ107XG5jb25zdCBSRVNFUlZFRF9HUkFQSFFMX01VVEFUSU9OX05BTUVTID0gW1xuICAnc2lnblVwJyxcbiAgJ2xvZ0luJyxcbiAgJ2xvZ091dCcsXG4gICdjcmVhdGVGaWxlJyxcbiAgJ2NhbGxDbG91ZENvZGUnLFxuICAnY3JlYXRlQ2xhc3MnLFxuICAndXBkYXRlQ2xhc3MnLFxuICAnZGVsZXRlQ2xhc3MnLFxuXTtcblxuY2xhc3MgUGFyc2VHcmFwaFFMU2NoZW1hIHtcbiAgZGF0YWJhc2VDb250cm9sbGVyOiBEYXRhYmFzZUNvbnRyb2xsZXI7XG4gIHBhcnNlR3JhcGhRTENvbnRyb2xsZXI6IFBhcnNlR3JhcGhRTENvbnRyb2xsZXI7XG4gIHBhcnNlR3JhcGhRTENvbmZpZzogUGFyc2VHcmFwaFFMQ29uZmlnO1xuICBsb2c6IGFueTtcbiAgYXBwSWQ6IHN0cmluZztcbiAgZ3JhcGhRTEN1c3RvbVR5cGVEZWZzOiA/KFxuICAgIHwgc3RyaW5nXG4gICAgfCBHcmFwaFFMU2NoZW1hXG4gICAgfCBEb2N1bWVudE5vZGVcbiAgICB8IEdyYXBoUUxOYW1lZFR5cGVbXVxuICApO1xuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHBhcmFtczoge1xuICAgICAgZGF0YWJhc2VDb250cm9sbGVyOiBEYXRhYmFzZUNvbnRyb2xsZXIsXG4gICAgICBwYXJzZUdyYXBoUUxDb250cm9sbGVyOiBQYXJzZUdyYXBoUUxDb250cm9sbGVyLFxuICAgICAgbG9nOiBhbnksXG4gICAgICBhcHBJZDogc3RyaW5nLFxuICAgICAgZ3JhcGhRTEN1c3RvbVR5cGVEZWZzOiA/KFxuICAgICAgICB8IHN0cmluZ1xuICAgICAgICB8IEdyYXBoUUxTY2hlbWFcbiAgICAgICAgfCBEb2N1bWVudE5vZGVcbiAgICAgICAgfCBHcmFwaFFMTmFtZWRUeXBlW11cbiAgICAgICksXG4gICAgfSA9IHt9XG4gICkge1xuICAgIHRoaXMucGFyc2VHcmFwaFFMQ29udHJvbGxlciA9XG4gICAgICBwYXJhbXMucGFyc2VHcmFwaFFMQ29udHJvbGxlciB8fFxuICAgICAgcmVxdWlyZWRQYXJhbWV0ZXIoJ1lvdSBtdXN0IHByb3ZpZGUgYSBwYXJzZUdyYXBoUUxDb250cm9sbGVyIGluc3RhbmNlIScpO1xuICAgIHRoaXMuZGF0YWJhc2VDb250cm9sbGVyID1cbiAgICAgIHBhcmFtcy5kYXRhYmFzZUNvbnRyb2xsZXIgfHxcbiAgICAgIHJlcXVpcmVkUGFyYW1ldGVyKCdZb3UgbXVzdCBwcm92aWRlIGEgZGF0YWJhc2VDb250cm9sbGVyIGluc3RhbmNlIScpO1xuICAgIHRoaXMubG9nID1cbiAgICAgIHBhcmFtcy5sb2cgfHwgcmVxdWlyZWRQYXJhbWV0ZXIoJ1lvdSBtdXN0IHByb3ZpZGUgYSBsb2cgaW5zdGFuY2UhJyk7XG4gICAgdGhpcy5ncmFwaFFMQ3VzdG9tVHlwZURlZnMgPSBwYXJhbXMuZ3JhcGhRTEN1c3RvbVR5cGVEZWZzO1xuICAgIHRoaXMuYXBwSWQgPVxuICAgICAgcGFyYW1zLmFwcElkIHx8IHJlcXVpcmVkUGFyYW1ldGVyKCdZb3UgbXVzdCBwcm92aWRlIHRoZSBhcHBJZCEnKTtcbiAgfVxuXG4gIGFzeW5jIGxvYWQoKSB7XG4gICAgY29uc3QgeyBwYXJzZUdyYXBoUUxDb25maWcgfSA9IGF3YWl0IHRoaXMuX2luaXRpYWxpemVTY2hlbWFBbmRDb25maWcoKTtcbiAgICBjb25zdCBwYXJzZUNsYXNzZXMgPSBhd2FpdCB0aGlzLl9nZXRDbGFzc2VzRm9yU2NoZW1hKHBhcnNlR3JhcGhRTENvbmZpZyk7XG4gICAgY29uc3QgcGFyc2VDbGFzc2VzU3RyaW5nID0gSlNPTi5zdHJpbmdpZnkocGFyc2VDbGFzc2VzKTtcbiAgICBjb25zdCBmdW5jdGlvbk5hbWVzID0gYXdhaXQgdGhpcy5fZ2V0RnVuY3Rpb25OYW1lcygpO1xuICAgIGNvbnN0IGZ1bmN0aW9uTmFtZXNTdHJpbmcgPSBKU09OLnN0cmluZ2lmeShmdW5jdGlvbk5hbWVzKTtcblxuICAgIGlmIChcbiAgICAgIHRoaXMuZ3JhcGhRTFNjaGVtYSAmJlxuICAgICAgIXRoaXMuX2hhc1NjaGVtYUlucHV0Q2hhbmdlZCh7XG4gICAgICAgIHBhcnNlQ2xhc3NlcyxcbiAgICAgICAgcGFyc2VDbGFzc2VzU3RyaW5nLFxuICAgICAgICBwYXJzZUdyYXBoUUxDb25maWcsXG4gICAgICAgIGZ1bmN0aW9uTmFtZXNTdHJpbmcsXG4gICAgICB9KVxuICAgICkge1xuICAgICAgcmV0dXJuIHRoaXMuZ3JhcGhRTFNjaGVtYTtcbiAgICB9XG5cbiAgICB0aGlzLnBhcnNlQ2xhc3NlcyA9IHBhcnNlQ2xhc3NlcztcbiAgICB0aGlzLnBhcnNlQ2xhc3Nlc1N0cmluZyA9IHBhcnNlQ2xhc3Nlc1N0cmluZztcbiAgICB0aGlzLnBhcnNlR3JhcGhRTENvbmZpZyA9IHBhcnNlR3JhcGhRTENvbmZpZztcbiAgICB0aGlzLmZ1bmN0aW9uTmFtZXMgPSBmdW5jdGlvbk5hbWVzO1xuICAgIHRoaXMuZnVuY3Rpb25OYW1lc1N0cmluZyA9IGZ1bmN0aW9uTmFtZXNTdHJpbmc7XG4gICAgdGhpcy5wYXJzZUNsYXNzVHlwZXMgPSB7fTtcbiAgICB0aGlzLnZpZXdlclR5cGUgPSBudWxsO1xuICAgIHRoaXMuZ3JhcGhRTEF1dG9TY2hlbWEgPSBudWxsO1xuICAgIHRoaXMuZ3JhcGhRTFNjaGVtYSA9IG51bGw7XG4gICAgdGhpcy5ncmFwaFFMVHlwZXMgPSBbXTtcbiAgICB0aGlzLmdyYXBoUUxRdWVyaWVzID0ge307XG4gICAgdGhpcy5ncmFwaFFMTXV0YXRpb25zID0ge307XG4gICAgdGhpcy5ncmFwaFFMU3Vic2NyaXB0aW9ucyA9IHt9O1xuICAgIHRoaXMuZ3JhcGhRTFNjaGVtYURpcmVjdGl2ZXNEZWZpbml0aW9ucyA9IG51bGw7XG4gICAgdGhpcy5ncmFwaFFMU2NoZW1hRGlyZWN0aXZlcyA9IHt9O1xuICAgIHRoaXMucmVsYXlOb2RlSW50ZXJmYWNlID0gbnVsbDtcblxuICAgIGRlZmF1bHRHcmFwaFFMVHlwZXMubG9hZCh0aGlzKTtcbiAgICBkZWZhdWx0UmVsYXlTY2hlbWEubG9hZCh0aGlzKTtcbiAgICBzY2hlbWFUeXBlcy5sb2FkKHRoaXMpO1xuXG4gICAgdGhpcy5fZ2V0UGFyc2VDbGFzc2VzV2l0aENvbmZpZyhwYXJzZUNsYXNzZXMsIHBhcnNlR3JhcGhRTENvbmZpZykuZm9yRWFjaChcbiAgICAgIChbcGFyc2VDbGFzcywgcGFyc2VDbGFzc0NvbmZpZ10pID0+IHtcbiAgICAgICAgcGFyc2VDbGFzc1R5cGVzLmxvYWQodGhpcywgcGFyc2VDbGFzcywgcGFyc2VDbGFzc0NvbmZpZyk7XG4gICAgICAgIHBhcnNlQ2xhc3NRdWVyaWVzLmxvYWQodGhpcywgcGFyc2VDbGFzcywgcGFyc2VDbGFzc0NvbmZpZyk7XG4gICAgICAgIHBhcnNlQ2xhc3NNdXRhdGlvbnMubG9hZCh0aGlzLCBwYXJzZUNsYXNzLCBwYXJzZUNsYXNzQ29uZmlnKTtcbiAgICAgIH1cbiAgICApO1xuXG4gICAgZGVmYXVsdEdyYXBoUUxUeXBlcy5sb2FkQXJyYXlSZXN1bHQodGhpcywgcGFyc2VDbGFzc2VzKTtcbiAgICBkZWZhdWx0R3JhcGhRTFF1ZXJpZXMubG9hZCh0aGlzKTtcbiAgICBkZWZhdWx0R3JhcGhRTE11dGF0aW9ucy5sb2FkKHRoaXMpO1xuXG4gICAgbGV0IGdyYXBoUUxRdWVyeSA9IHVuZGVmaW5lZDtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5ncmFwaFFMUXVlcmllcykubGVuZ3RoID4gMCkge1xuICAgICAgZ3JhcGhRTFF1ZXJ5ID0gbmV3IEdyYXBoUUxPYmplY3RUeXBlKHtcbiAgICAgICAgbmFtZTogJ1F1ZXJ5JyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdRdWVyeSBpcyB0aGUgdG9wIGxldmVsIHR5cGUgZm9yIHF1ZXJpZXMuJyxcbiAgICAgICAgZmllbGRzOiB0aGlzLmdyYXBoUUxRdWVyaWVzLFxuICAgICAgfSk7XG4gICAgICB0aGlzLmFkZEdyYXBoUUxUeXBlKGdyYXBoUUxRdWVyeSwgdHJ1ZSwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgbGV0IGdyYXBoUUxNdXRhdGlvbiA9IHVuZGVmaW5lZDtcbiAgICBpZiAoT2JqZWN0LmtleXModGhpcy5ncmFwaFFMTXV0YXRpb25zKS5sZW5ndGggPiAwKSB7XG4gICAgICBncmFwaFFMTXV0YXRpb24gPSBuZXcgR3JhcGhRTE9iamVjdFR5cGUoe1xuICAgICAgICBuYW1lOiAnTXV0YXRpb24nLFxuICAgICAgICBkZXNjcmlwdGlvbjogJ011dGF0aW9uIGlzIHRoZSB0b3AgbGV2ZWwgdHlwZSBmb3IgbXV0YXRpb25zLicsXG4gICAgICAgIGZpZWxkczogdGhpcy5ncmFwaFFMTXV0YXRpb25zLFxuICAgICAgfSk7XG4gICAgICB0aGlzLmFkZEdyYXBoUUxUeXBlKGdyYXBoUUxNdXRhdGlvbiwgdHJ1ZSwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgbGV0IGdyYXBoUUxTdWJzY3JpcHRpb24gPSB1bmRlZmluZWQ7XG4gICAgaWYgKE9iamVjdC5rZXlzKHRoaXMuZ3JhcGhRTFN1YnNjcmlwdGlvbnMpLmxlbmd0aCA+IDApIHtcbiAgICAgIGdyYXBoUUxTdWJzY3JpcHRpb24gPSBuZXcgR3JhcGhRTE9iamVjdFR5cGUoe1xuICAgICAgICBuYW1lOiAnU3Vic2NyaXB0aW9uJyxcbiAgICAgICAgZGVzY3JpcHRpb246ICdTdWJzY3JpcHRpb24gaXMgdGhlIHRvcCBsZXZlbCB0eXBlIGZvciBzdWJzY3JpcHRpb25zLicsXG4gICAgICAgIGZpZWxkczogdGhpcy5ncmFwaFFMU3Vic2NyaXB0aW9ucyxcbiAgICAgIH0pO1xuICAgICAgdGhpcy5hZGRHcmFwaFFMVHlwZShncmFwaFFMU3Vic2NyaXB0aW9uLCB0cnVlLCB0cnVlKTtcbiAgICB9XG5cbiAgICB0aGlzLmdyYXBoUUxBdXRvU2NoZW1hID0gbmV3IEdyYXBoUUxTY2hlbWEoe1xuICAgICAgdHlwZXM6IHRoaXMuZ3JhcGhRTFR5cGVzLFxuICAgICAgcXVlcnk6IGdyYXBoUUxRdWVyeSxcbiAgICAgIG11dGF0aW9uOiBncmFwaFFMTXV0YXRpb24sXG4gICAgICBzdWJzY3JpcHRpb246IGdyYXBoUUxTdWJzY3JpcHRpb24sXG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5ncmFwaFFMQ3VzdG9tVHlwZURlZnMpIHtcbiAgICAgIHNjaGVtYURpcmVjdGl2ZXMubG9hZCh0aGlzKTtcblxuICAgICAgaWYgKHR5cGVvZiB0aGlzLmdyYXBoUUxDdXN0b21UeXBlRGVmcy5nZXRUeXBlTWFwID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGNvbnN0IGN1c3RvbUdyYXBoUUxTY2hlbWFUeXBlTWFwID0gdGhpcy5ncmFwaFFMQ3VzdG9tVHlwZURlZnMuZ2V0VHlwZU1hcCgpO1xuICAgICAgICBPYmplY3QudmFsdWVzKGN1c3RvbUdyYXBoUUxTY2hlbWFUeXBlTWFwKS5mb3JFYWNoKFxuICAgICAgICAgIChjdXN0b21HcmFwaFFMU2NoZW1hVHlwZSkgPT4ge1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAhY3VzdG9tR3JhcGhRTFNjaGVtYVR5cGUgfHxcbiAgICAgICAgICAgICAgIWN1c3RvbUdyYXBoUUxTY2hlbWFUeXBlLm5hbWUgfHxcbiAgICAgICAgICAgICAgY3VzdG9tR3JhcGhRTFNjaGVtYVR5cGUubmFtZS5zdGFydHNXaXRoKCdfXycpXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgY29uc3QgYXV0b0dyYXBoUUxTY2hlbWFUeXBlID0gdGhpcy5ncmFwaFFMQXV0b1NjaGVtYS5nZXRUeXBlKFxuICAgICAgICAgICAgICBjdXN0b21HcmFwaFFMU2NoZW1hVHlwZS5uYW1lXG4gICAgICAgICAgICApO1xuICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICBhdXRvR3JhcGhRTFNjaGVtYVR5cGUgJiZcbiAgICAgICAgICAgICAgdHlwZW9mIGN1c3RvbUdyYXBoUUxTY2hlbWFUeXBlLmdldEZpZWxkcyA9PT0gJ2Z1bmN0aW9uJ1xuICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgIGNvbnN0IGZpbmRBbmRSZXBsYWNlTGFzdFR5cGUgPSAocGFyZW50LCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAocGFyZW50W2tleV0ubmFtZSkge1xuICAgICAgICAgICAgICAgICAgaWYgKFxuICAgICAgICAgICAgICAgICAgICB0aGlzLmdyYXBoUUxBdXRvU2NoZW1hLmdldFR5cGUocGFyZW50W2tleV0ubmFtZSkgJiZcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5ncmFwaFFMQXV0b1NjaGVtYS5nZXRUeXBlKHBhcmVudFtrZXldLm5hbWUpICE9PVxuICAgICAgICAgICAgICAgICAgICAgIHBhcmVudFtrZXldXG4gICAgICAgICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICAgICAgLy8gVG8gYXZvaWQgdW5yZXNvbHZlZCBmaWVsZCBvbiBvdmVybG9hZGVkIHNjaGVtYVxuICAgICAgICAgICAgICAgICAgICAvLyByZXBsYWNlIHRoZSBmaW5hbCB0eXBlIHdpdGggdGhlIGF1dG8gc2NoZW1hIG9uZVxuICAgICAgICAgICAgICAgICAgICBwYXJlbnRba2V5XSA9IHRoaXMuZ3JhcGhRTEF1dG9TY2hlbWEuZ2V0VHlwZShcbiAgICAgICAgICAgICAgICAgICAgICBwYXJlbnRba2V5XS5uYW1lXG4gICAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGlmIChwYXJlbnRba2V5XS5vZlR5cGUpIHtcbiAgICAgICAgICAgICAgICAgICAgZmluZEFuZFJlcGxhY2VMYXN0VHlwZShwYXJlbnRba2V5XSwgJ29mVHlwZScpO1xuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICBPYmplY3QudmFsdWVzKGN1c3RvbUdyYXBoUUxTY2hlbWFUeXBlLmdldEZpZWxkcygpKS5mb3JFYWNoKFxuICAgICAgICAgICAgICAgIChmaWVsZCkgPT4ge1xuICAgICAgICAgICAgICAgICAgZmluZEFuZFJlcGxhY2VMYXN0VHlwZShmaWVsZCwgJ3R5cGUnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgIGF1dG9HcmFwaFFMU2NoZW1hVHlwZS5fZmllbGRzID0ge1xuICAgICAgICAgICAgICAgIC4uLmF1dG9HcmFwaFFMU2NoZW1hVHlwZS5nZXRGaWVsZHMoKSxcbiAgICAgICAgICAgICAgICAuLi5jdXN0b21HcmFwaFFMU2NoZW1hVHlwZS5nZXRGaWVsZHMoKSxcbiAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIHRoaXMuZ3JhcGhRTEF1dG9TY2hlbWEuX3R5cGVNYXBbXG4gICAgICAgICAgICAgICAgY3VzdG9tR3JhcGhRTFNjaGVtYVR5cGUubmFtZVxuICAgICAgICAgICAgICBdID0gY3VzdG9tR3JhcGhRTFNjaGVtYVR5cGU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICApO1xuICAgICAgICB0aGlzLmdyYXBoUUxTY2hlbWEgPSBtZXJnZVNjaGVtYXMoe1xuICAgICAgICAgIHNjaGVtYXM6IFtcbiAgICAgICAgICAgIHRoaXMuZ3JhcGhRTFNjaGVtYURpcmVjdGl2ZXNEZWZpbml0aW9ucyxcbiAgICAgICAgICAgIHRoaXMuZ3JhcGhRTEF1dG9TY2hlbWEsXG4gICAgICAgICAgXSxcbiAgICAgICAgICBtZXJnZURpcmVjdGl2ZXM6IHRydWUsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgdGhpcy5ncmFwaFFMQ3VzdG9tVHlwZURlZnMgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgdGhpcy5ncmFwaFFMU2NoZW1hID0gYXdhaXQgdGhpcy5ncmFwaFFMQ3VzdG9tVHlwZURlZnMoe1xuICAgICAgICAgIGRpcmVjdGl2ZXNEZWZpbml0aW9uc1NjaGVtYTogdGhpcy5ncmFwaFFMU2NoZW1hRGlyZWN0aXZlc0RlZmluaXRpb25zLFxuICAgICAgICAgIGF1dG9TY2hlbWE6IHRoaXMuZ3JhcGhRTEF1dG9TY2hlbWEsXG4gICAgICAgICAgbWVyZ2VTY2hlbWFzLFxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZ3JhcGhRTFNjaGVtYSA9IG1lcmdlU2NoZW1hcyh7XG4gICAgICAgICAgc2NoZW1hczogW1xuICAgICAgICAgICAgdGhpcy5ncmFwaFFMU2NoZW1hRGlyZWN0aXZlc0RlZmluaXRpb25zLFxuICAgICAgICAgICAgdGhpcy5ncmFwaFFMQXV0b1NjaGVtYSxcbiAgICAgICAgICAgIHRoaXMuZ3JhcGhRTEN1c3RvbVR5cGVEZWZzLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgbWVyZ2VEaXJlY3RpdmVzOiB0cnVlLFxuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZ3JhcGhRTFNjaGVtYVR5cGVNYXAgPSB0aGlzLmdyYXBoUUxTY2hlbWEuZ2V0VHlwZU1hcCgpO1xuICAgICAgT2JqZWN0LmtleXMoZ3JhcGhRTFNjaGVtYVR5cGVNYXApLmZvckVhY2goKGdyYXBoUUxTY2hlbWFUeXBlTmFtZSkgPT4ge1xuICAgICAgICBjb25zdCBncmFwaFFMU2NoZW1hVHlwZSA9IGdyYXBoUUxTY2hlbWFUeXBlTWFwW2dyYXBoUUxTY2hlbWFUeXBlTmFtZV07XG4gICAgICAgIGlmIChcbiAgICAgICAgICB0eXBlb2YgZ3JhcGhRTFNjaGVtYVR5cGUuZ2V0RmllbGRzID09PSAnZnVuY3Rpb24nICYmXG4gICAgICAgICAgdGhpcy5ncmFwaFFMQ3VzdG9tVHlwZURlZnMuZGVmaW5pdGlvbnNcbiAgICAgICAgKSB7XG4gICAgICAgICAgY29uc3QgZ3JhcGhRTEN1c3RvbVR5cGVEZWYgPSB0aGlzLmdyYXBoUUxDdXN0b21UeXBlRGVmcy5kZWZpbml0aW9ucy5maW5kKFxuICAgICAgICAgICAgKGRlZmluaXRpb24pID0+IGRlZmluaXRpb24ubmFtZS52YWx1ZSA9PT0gZ3JhcGhRTFNjaGVtYVR5cGVOYW1lXG4gICAgICAgICAgKTtcbiAgICAgICAgICBpZiAoZ3JhcGhRTEN1c3RvbVR5cGVEZWYpIHtcbiAgICAgICAgICAgIGNvbnN0IGdyYXBoUUxTY2hlbWFUeXBlRmllbGRNYXAgPSBncmFwaFFMU2NoZW1hVHlwZS5nZXRGaWVsZHMoKTtcbiAgICAgICAgICAgIE9iamVjdC5rZXlzKGdyYXBoUUxTY2hlbWFUeXBlRmllbGRNYXApLmZvckVhY2goXG4gICAgICAgICAgICAgIChncmFwaFFMU2NoZW1hVHlwZUZpZWxkTmFtZSkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGdyYXBoUUxTY2hlbWFUeXBlRmllbGQgPVxuICAgICAgICAgICAgICAgICAgZ3JhcGhRTFNjaGVtYVR5cGVGaWVsZE1hcFtncmFwaFFMU2NoZW1hVHlwZUZpZWxkTmFtZV07XG4gICAgICAgICAgICAgICAgaWYgKCFncmFwaFFMU2NoZW1hVHlwZUZpZWxkLmFzdE5vZGUpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGFzdE5vZGUgPSBncmFwaFFMQ3VzdG9tVHlwZURlZi5maWVsZHMuZmluZChcbiAgICAgICAgICAgICAgICAgICAgKGZpZWxkKSA9PiBmaWVsZC5uYW1lLnZhbHVlID09PSBncmFwaFFMU2NoZW1hVHlwZUZpZWxkTmFtZVxuICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgIGlmIChhc3ROb2RlKSB7XG4gICAgICAgICAgICAgICAgICAgIGdyYXBoUUxTY2hlbWFUeXBlRmllbGQuYXN0Tm9kZSA9IGFzdE5vZGU7XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSk7XG5cbiAgICAgIFNjaGVtYURpcmVjdGl2ZVZpc2l0b3IudmlzaXRTY2hlbWFEaXJlY3RpdmVzKFxuICAgICAgICB0aGlzLmdyYXBoUUxTY2hlbWEsXG4gICAgICAgIHRoaXMuZ3JhcGhRTFNjaGVtYURpcmVjdGl2ZXNcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZ3JhcGhRTFNjaGVtYSA9IHRoaXMuZ3JhcGhRTEF1dG9TY2hlbWE7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuZ3JhcGhRTFNjaGVtYTtcbiAgfVxuXG4gIGFkZEdyYXBoUUxUeXBlKFxuICAgIHR5cGUsXG4gICAgdGhyb3dFcnJvciA9IGZhbHNlLFxuICAgIGlnbm9yZVJlc2VydmVkID0gZmFsc2UsXG4gICAgaWdub3JlQ29ubmVjdGlvbiA9IGZhbHNlXG4gICkge1xuICAgIGlmIChcbiAgICAgICghaWdub3JlUmVzZXJ2ZWQgJiYgUkVTRVJWRURfR1JBUEhRTF9UWVBFX05BTUVTLmluY2x1ZGVzKHR5cGUubmFtZSkpIHx8XG4gICAgICB0aGlzLmdyYXBoUUxUeXBlcy5maW5kKFxuICAgICAgICAoZXhpc3RpbmdUeXBlKSA9PiBleGlzdGluZ1R5cGUubmFtZSA9PT0gdHlwZS5uYW1lXG4gICAgICApIHx8XG4gICAgICAoIWlnbm9yZUNvbm5lY3Rpb24gJiYgdHlwZS5uYW1lLmVuZHNXaXRoKCdDb25uZWN0aW9uJykpXG4gICAgKSB7XG4gICAgICBjb25zdCBtZXNzYWdlID0gYFR5cGUgJHt0eXBlLm5hbWV9IGNvdWxkIG5vdCBiZSBhZGRlZCB0byB0aGUgYXV0byBzY2hlbWEgYmVjYXVzZSBpdCBjb2xsaWRlZCB3aXRoIGFuIGV4aXN0aW5nIHR5cGUuYDtcbiAgICAgIGlmICh0aHJvd0Vycm9yKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9nLndhcm4obWVzc2FnZSk7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICB0aGlzLmdyYXBoUUxUeXBlcy5wdXNoKHR5cGUpO1xuICAgIHJldHVybiB0eXBlO1xuICB9XG5cbiAgYWRkR3JhcGhRTFF1ZXJ5KFxuICAgIGZpZWxkTmFtZSxcbiAgICBmaWVsZCxcbiAgICB0aHJvd0Vycm9yID0gZmFsc2UsXG4gICAgaWdub3JlUmVzZXJ2ZWQgPSBmYWxzZVxuICApIHtcbiAgICBpZiAoXG4gICAgICAoIWlnbm9yZVJlc2VydmVkICYmIFJFU0VSVkVEX0dSQVBIUUxfUVVFUllfTkFNRVMuaW5jbHVkZXMoZmllbGROYW1lKSkgfHxcbiAgICAgIHRoaXMuZ3JhcGhRTFF1ZXJpZXNbZmllbGROYW1lXVxuICAgICkge1xuICAgICAgY29uc3QgbWVzc2FnZSA9IGBRdWVyeSAke2ZpZWxkTmFtZX0gY291bGQgbm90IGJlIGFkZGVkIHRvIHRoZSBhdXRvIHNjaGVtYSBiZWNhdXNlIGl0IGNvbGxpZGVkIHdpdGggYW4gZXhpc3RpbmcgZmllbGQuYDtcbiAgICAgIGlmICh0aHJvd0Vycm9yKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtZXNzYWdlKTtcbiAgICAgIH1cbiAgICAgIHRoaXMubG9nLndhcm4obWVzc2FnZSk7XG4gICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgIH1cbiAgICB0aGlzLmdyYXBoUUxRdWVyaWVzW2ZpZWxkTmFtZV0gPSBmaWVsZDtcbiAgICByZXR1cm4gZmllbGQ7XG4gIH1cblxuICBhZGRHcmFwaFFMTXV0YXRpb24oXG4gICAgZmllbGROYW1lLFxuICAgIGZpZWxkLFxuICAgIHRocm93RXJyb3IgPSBmYWxzZSxcbiAgICBpZ25vcmVSZXNlcnZlZCA9IGZhbHNlXG4gICkge1xuICAgIGlmIChcbiAgICAgICghaWdub3JlUmVzZXJ2ZWQgJiZcbiAgICAgICAgUkVTRVJWRURfR1JBUEhRTF9NVVRBVElPTl9OQU1FUy5pbmNsdWRlcyhmaWVsZE5hbWUpKSB8fFxuICAgICAgdGhpcy5ncmFwaFFMTXV0YXRpb25zW2ZpZWxkTmFtZV1cbiAgICApIHtcbiAgICAgIGNvbnN0IG1lc3NhZ2UgPSBgTXV0YXRpb24gJHtmaWVsZE5hbWV9IGNvdWxkIG5vdCBiZSBhZGRlZCB0byB0aGUgYXV0byBzY2hlbWEgYmVjYXVzZSBpdCBjb2xsaWRlZCB3aXRoIGFuIGV4aXN0aW5nIGZpZWxkLmA7XG4gICAgICBpZiAodGhyb3dFcnJvcikge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IobWVzc2FnZSk7XG4gICAgICB9XG4gICAgICB0aGlzLmxvZy53YXJuKG1lc3NhZ2UpO1xuICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICB9XG4gICAgdGhpcy5ncmFwaFFMTXV0YXRpb25zW2ZpZWxkTmFtZV0gPSBmaWVsZDtcbiAgICByZXR1cm4gZmllbGQ7XG4gIH1cblxuICBoYW5kbGVFcnJvcihlcnJvcikge1xuICAgIGlmIChlcnJvciBpbnN0YW5jZW9mIFBhcnNlLkVycm9yKSB7XG4gICAgICB0aGlzLmxvZy5lcnJvcignUGFyc2UgZXJyb3I6ICcsIGVycm9yKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5sb2cuZXJyb3IoJ1VuY2F1Z2h0IGludGVybmFsIHNlcnZlciBlcnJvci4nLCBlcnJvciwgZXJyb3Iuc3RhY2spO1xuICAgIH1cbiAgICB0aHJvdyB0b0dyYXBoUUxFcnJvcihlcnJvcik7XG4gIH1cblxuICBhc3luYyBfaW5pdGlhbGl6ZVNjaGVtYUFuZENvbmZpZygpIHtcbiAgICBjb25zdCBbc2NoZW1hQ29udHJvbGxlciwgcGFyc2VHcmFwaFFMQ29uZmlnXSA9IGF3YWl0IFByb21pc2UuYWxsKFtcbiAgICAgIHRoaXMuZGF0YWJhc2VDb250cm9sbGVyLmxvYWRTY2hlbWEoKSxcbiAgICAgIHRoaXMucGFyc2VHcmFwaFFMQ29udHJvbGxlci5nZXRHcmFwaFFMQ29uZmlnKCksXG4gICAgXSk7XG5cbiAgICB0aGlzLnNjaGVtYUNvbnRyb2xsZXIgPSBzY2hlbWFDb250cm9sbGVyO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIHBhcnNlR3JhcGhRTENvbmZpZyxcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgYWxsIGNsYXNzZXMgZm91bmQgYnkgdGhlIGBzY2hlbWFDb250cm9sbGVyYFxuICAgKiBtaW51cyB0aG9zZSBmaWx0ZXJlZCBvdXQgYnkgdGhlIGFwcCdzIHBhcnNlR3JhcGhRTENvbmZpZy5cbiAgICovXG4gIGFzeW5jIF9nZXRDbGFzc2VzRm9yU2NoZW1hKHBhcnNlR3JhcGhRTENvbmZpZzogUGFyc2VHcmFwaFFMQ29uZmlnKSB7XG4gICAgY29uc3QgeyBlbmFibGVkRm9yQ2xhc3NlcywgZGlzYWJsZWRGb3JDbGFzc2VzIH0gPSBwYXJzZUdyYXBoUUxDb25maWc7XG4gICAgY29uc3QgYWxsQ2xhc3NlcyA9IGF3YWl0IHRoaXMuc2NoZW1hQ29udHJvbGxlci5nZXRBbGxDbGFzc2VzKCk7XG5cbiAgICBpZiAoQXJyYXkuaXNBcnJheShlbmFibGVkRm9yQ2xhc3NlcykgfHwgQXJyYXkuaXNBcnJheShkaXNhYmxlZEZvckNsYXNzZXMpKSB7XG4gICAgICBsZXQgaW5jbHVkZWRDbGFzc2VzID0gYWxsQ2xhc3NlcztcbiAgICAgIGlmIChlbmFibGVkRm9yQ2xhc3Nlcykge1xuICAgICAgICBpbmNsdWRlZENsYXNzZXMgPSBhbGxDbGFzc2VzLmZpbHRlcigoY2xhenopID0+IHtcbiAgICAgICAgICByZXR1cm4gZW5hYmxlZEZvckNsYXNzZXMuaW5jbHVkZXMoY2xhenouY2xhc3NOYW1lKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBpZiAoZGlzYWJsZWRGb3JDbGFzc2VzKSB7XG4gICAgICAgIC8vIENsYXNzZXMgaW5jbHVkZWQgaW4gYGVuYWJsZWRGb3JDbGFzc2VzYCB0aGF0XG4gICAgICAgIC8vIGFyZSBhbHNvIHByZXNlbnQgaW4gYGRpc2FibGVkRm9yQ2xhc3Nlc2Agd2lsbFxuICAgICAgICAvLyBzdGlsbCBiZSBmaWx0ZXJlZCBvdXRcbiAgICAgICAgaW5jbHVkZWRDbGFzc2VzID0gaW5jbHVkZWRDbGFzc2VzLmZpbHRlcigoY2xhenopID0+IHtcbiAgICAgICAgICByZXR1cm4gIWRpc2FibGVkRm9yQ2xhc3Nlcy5pbmNsdWRlcyhjbGF6ei5jbGFzc05hbWUpO1xuICAgICAgICB9KTtcbiAgICAgIH1cblxuICAgICAgdGhpcy5pc1VzZXJzQ2xhc3NEaXNhYmxlZCA9ICFpbmNsdWRlZENsYXNzZXMuc29tZSgoY2xhenopID0+IHtcbiAgICAgICAgcmV0dXJuIGNsYXp6LmNsYXNzTmFtZSA9PT0gJ19Vc2VyJztcbiAgICAgIH0pO1xuXG4gICAgICByZXR1cm4gaW5jbHVkZWRDbGFzc2VzO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gYWxsQ2xhc3NlcztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBtZXRob2QgcmV0dXJucyBhIGxpc3Qgb2YgdHVwbGVzXG4gICAqIHRoYXQgcHJvdmlkZSB0aGUgcGFyc2VDbGFzcyBhbG9uZyB3aXRoXG4gICAqIGl0cyBwYXJzZUNsYXNzQ29uZmlnIHdoZXJlIHByb3ZpZGVkLlxuICAgKi9cbiAgX2dldFBhcnNlQ2xhc3Nlc1dpdGhDb25maWcoXG4gICAgcGFyc2VDbGFzc2VzLFxuICAgIHBhcnNlR3JhcGhRTENvbmZpZzogUGFyc2VHcmFwaFFMQ29uZmlnXG4gICkge1xuICAgIGNvbnN0IHsgY2xhc3NDb25maWdzIH0gPSBwYXJzZUdyYXBoUUxDb25maWc7XG5cbiAgICAvLyBNYWtlIHN1cmVzIHRoYXQgdGhlIGRlZmF1bHQgY2xhc3NlcyBhbmQgY2xhc3NlcyB0aGF0XG4gICAgLy8gc3RhcnRzIHdpdGggY2FwaXRhbGl6ZWQgbGV0dGVyIHdpbGwgYmUgZ2VuZXJhdGVkIGZpcnN0LlxuICAgIGNvbnN0IHNvcnRDbGFzc2VzID0gKGEsIGIpID0+IHtcbiAgICAgIGEgPSBhLmNsYXNzTmFtZTtcbiAgICAgIGIgPSBiLmNsYXNzTmFtZTtcbiAgICAgIGlmIChhWzBdID09PSAnXycpIHtcbiAgICAgICAgaWYgKGJbMF0gIT09ICdfJykge1xuICAgICAgICAgIHJldHVybiAtMTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGJbMF0gPT09ICdfJykge1xuICAgICAgICBpZiAoYVswXSAhPT0gJ18nKSB7XG4gICAgICAgICAgcmV0dXJuIDE7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChhID09PSBiKSB7XG4gICAgICAgIHJldHVybiAwO1xuICAgICAgfSBlbHNlIGlmIChhIDwgYikge1xuICAgICAgICByZXR1cm4gLTE7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gMTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgcmV0dXJuIHBhcnNlQ2xhc3Nlcy5zb3J0KHNvcnRDbGFzc2VzKS5tYXAoKHBhcnNlQ2xhc3MpID0+IHtcbiAgICAgIGxldCBwYXJzZUNsYXNzQ29uZmlnO1xuICAgICAgaWYgKGNsYXNzQ29uZmlncykge1xuICAgICAgICBwYXJzZUNsYXNzQ29uZmlnID0gY2xhc3NDb25maWdzLmZpbmQoXG4gICAgICAgICAgKGMpID0+IGMuY2xhc3NOYW1lID09PSBwYXJzZUNsYXNzLmNsYXNzTmFtZVxuICAgICAgICApO1xuICAgICAgfVxuICAgICAgcmV0dXJuIFtwYXJzZUNsYXNzLCBwYXJzZUNsYXNzQ29uZmlnXTtcbiAgICB9KTtcbiAgfVxuXG4gIGFzeW5jIF9nZXRGdW5jdGlvbk5hbWVzKCkge1xuICAgIHJldHVybiBhd2FpdCBnZXRGdW5jdGlvbk5hbWVzKHRoaXMuYXBwSWQpLmZpbHRlcigoZnVuY3Rpb25OYW1lKSA9PiB7XG4gICAgICBpZiAoL15bX2EtekEtWl1bX2EtekEtWjAtOV0qJC8udGVzdChmdW5jdGlvbk5hbWUpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5sb2cud2FybihcbiAgICAgICAgICBgRnVuY3Rpb24gJHtmdW5jdGlvbk5hbWV9IGNvdWxkIG5vdCBiZSBhZGRlZCB0byB0aGUgYXV0byBzY2hlbWEgYmVjYXVzZSBHcmFwaFFMIG5hbWVzIG11c3QgbWF0Y2ggL15bX2EtekEtWl1bX2EtekEtWjAtOV0qJC8uYFxuICAgICAgICApO1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ2hlY2tzIGZvciBjaGFuZ2VzIHRvIHRoZSBwYXJzZUNsYXNzZXNcbiAgICogb2JqZWN0cyAoaS5lLiBkYXRhYmFzZSBzY2hlbWEpIG9yIHRvXG4gICAqIHRoZSBwYXJzZUdyYXBoUUxDb25maWcgb2JqZWN0LiBJZiBub1xuICAgKiBjaGFuZ2VzIGFyZSBmb3VuZCwgcmV0dXJuIHRydWU7XG4gICAqL1xuICBfaGFzU2NoZW1hSW5wdXRDaGFuZ2VkKHBhcmFtczoge1xuICAgIHBhcnNlQ2xhc3NlczogYW55LFxuICAgIHBhcnNlQ2xhc3Nlc1N0cmluZzogc3RyaW5nLFxuICAgIHBhcnNlR3JhcGhRTENvbmZpZzogP1BhcnNlR3JhcGhRTENvbmZpZyxcbiAgICBmdW5jdGlvbk5hbWVzU3RyaW5nOiBzdHJpbmcsXG4gIH0pOiBib29sZWFuIHtcbiAgICBjb25zdCB7XG4gICAgICBwYXJzZUNsYXNzZXMsXG4gICAgICBwYXJzZUNsYXNzZXNTdHJpbmcsXG4gICAgICBwYXJzZUdyYXBoUUxDb25maWcsXG4gICAgICBmdW5jdGlvbk5hbWVzU3RyaW5nLFxuICAgIH0gPSBwYXJhbXM7XG5cbiAgICBpZiAoXG4gICAgICBKU09OLnN0cmluZ2lmeSh0aGlzLnBhcnNlR3JhcGhRTENvbmZpZykgPT09XG4gICAgICAgIEpTT04uc3RyaW5naWZ5KHBhcnNlR3JhcGhRTENvbmZpZykgJiZcbiAgICAgIHRoaXMuZnVuY3Rpb25OYW1lc1N0cmluZyA9PT0gZnVuY3Rpb25OYW1lc1N0cmluZ1xuICAgICkge1xuICAgICAgaWYgKHRoaXMucGFyc2VDbGFzc2VzID09PSBwYXJzZUNsYXNzZXMpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuXG4gICAgICBpZiAodGhpcy5wYXJzZUNsYXNzZXNTdHJpbmcgPT09IHBhcnNlQ2xhc3Nlc1N0cmluZykge1xuICAgICAgICB0aGlzLnBhcnNlQ2xhc3NlcyA9IHBhcnNlQ2xhc3NlcztcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9XG59XG5cbmV4cG9ydCB7IFBhcnNlR3JhcGhRTFNjaGVtYSB9O1xuIl19