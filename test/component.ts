import { fragment as fragmentCall } from '../src';
import { Post, User } from './input';
import 'graphql-tag';

interface AuthorProps {
  author:Pick<User, 'name' | 'photo'>;
}
interface DateTimeProps {
  post:Pick<Post, 'postedAt'>;
}

type PostProps =
  // Displaying direct props of the entity
  Pick<Post, 'id' | 'title'> &
  // Passing the entire entity to another component
  DateTimeProps['post'] &
  // Passing a prop of the entity to another component
  {
    author:AuthorProps['author'];
  } &
  // Deeply retrieving a prop from an entity
  {
    editor:{
      name:User['name'],
    },
  };

const query = `
  query getPosts() {
    posts() {
      ...${fragmentCall<PostProps, Post>(require('../graphql/getPosts.grapql'))}
    }
  }
`;

// fragment<T>() === `
//   fragment PostProps on Post {
//     id
//     title
//     postedAt
//     author {
//       id
//       name
//       photo
//     }
//   }
// `;
