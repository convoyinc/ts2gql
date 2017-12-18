// Type aliases become GraphQL scalars.
export type Url = string;

// If you want an explicit GraphQL ID type, you can do that too:
/** @graphql ID */
export type Id = string;

export type Email = string;

// Interfaces become GraphQL types.
export interface User {
  id:Id;
  name:string;
  photo:Url;
}

export interface PostContent {
  title:string;
  body:string;
}

export interface Post extends PostContent {
  id:Id;
  postedAt:Date;
  author:User;
  editor:User;
}

export interface Category {
  id:Id;
  name:string;
  posts:Post[];
}

// Methods are transformed into parameteried edges:
export interface QueryRoot {
  users(args:{id:Id}):User[];
  posts(args:{id:Id, authorId:Id, categoryId:Id}):Post[];
  categories(args:{id:Id}):Category[];
}

export interface MutationRoot {
  login(args:{username:string, password:string}):QueryRoot;
  sendEmail(args:{recipients:EmailRecipients[]}):QueryRoot;
}

// Don't forget to declare your schema and the root types!
/** @graphql schema */
export interface Schema {
  query:QueryRoot;
  mutation:MutationRoot;
}

// If you have input objects (http://docs.apollostack.com/graphql/schemas.html#input-objects)
/** @graphql input */
export interface EmailRecipients {
  type:string;
  name:string;
  email?:Email;
}

/**
 * @graphql required authorId
 */
export interface PostArguments {
  authorId:Id;
}

// You may also wish to expose some GraphQL specific fields or parameterized
// calls on particular types, while still preserving the shape of your
// interfaces for more general use:
/** @graphql override Category */
export interface CategoryOverrides {
  // for example, we may want to be able to filter or paginate posts:
  posts(args:PostArguments):Post[];
}
