import { GraphQLScalarType, Kind } from 'graphql';
import { Query } from './query.js';
import { Mutation } from './mutation.js';
import { Subscription } from './subscription.js';
import {
  User,
  Post,
  Comment,
  Hashtag,
  Notification,
  KeyValue,
} from './types.js';

const DateTime = new GraphQLScalarType({
  name: 'DateTime',
  description: 'ISO-8601 date-time string',
  serialize(value) {
    return value instanceof Date ? value.toISOString() : new Date(value as string).toISOString();
  },
  parseValue(value) {
    return new Date(value as string);
  },
  parseLiteral(ast) {
    return ast.kind === Kind.STRING ? new Date(ast.value) : null;
  },
});

export const resolvers = {
  DateTime,
  Query,
  Mutation,
  Subscription,
  User,
  Post,
  Comment,
  Hashtag,
  Notification,
  KeyValue,
};
