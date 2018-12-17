import { fragment } from '../../../dist/src';
import { Post, User } from './post_types';
import gql from 'graphql-tag';

interface AuthorProps {
  author:Pick<User, 'name' | 'photo'>;
}

interface DateTimeProps {
  post:Pick<Post, 'postedAt'>;
}

type PostProps =
  // When current component directly displays properties of the entity
  Pick<Post, 'id' | 'title'> &
  // When passing the entire entity to another component
  DateTimeProps['post'] &
  // Passing a prop of the entity to another component
  {
    author:AuthorProps['author'];
  } &
  // When current component displays deep properties of an entity
  {
    editor:{
      name:User['name'],
    },
  };

const query = gql`
  query getPosts() {
    posts() {
      ...${fragment<PostProps, Post>('./output.graphql')}
    }
  }
`;

// Pointless code to appease error TS6133: 'query' is declared but its value is never read.
if (!query) process.exit();
