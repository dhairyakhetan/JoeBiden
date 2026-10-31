import { Link, useLocation, useNavigate } from '../router.jsx';
import { editionLink } from '../data/editions.js';
import { useEdition } from '../lib/edition.js';
import { openedFromHome } from '../lib/routes.js';

// "Back to home" link: the home page of the page's own edition (/, or /sep26 for an older one). Opened from that home
// page: a real Back (same scroll spot, the card flies back into place). Otherwise (a shared link, a reload…): an
// ordinary link there.
export default function BackHome({ children, onClick, ...rest }) {
  const { key } = useLocation();
  const nav = useNavigate();
  const home = editionLink(useEdition().number);
  const back = (e) => {
    onClick?.(e);
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    if (openedFromHome(key, home)) { e.preventDefault(); nav(-1); }
  };
  return <Link to={home} onClick={back} {...rest}>{children}</Link>;
}
