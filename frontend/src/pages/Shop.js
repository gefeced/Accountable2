import { Navigate } from 'react-router-dom';

export default function Shop() {
  return <Navigate to="/main-shop?sector=chores" replace />;
}
