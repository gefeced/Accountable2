import { Navigate, useParams } from 'react-router-dom';

export default function GenericSectorShop() {
  const { sector } = useParams();
  const nextSector = sector || 'chores';

  return <Navigate to={`/main-shop?sector=${nextSector}`} replace />;
}
