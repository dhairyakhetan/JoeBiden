// Every router piece the magazine uses comes from here, never straight from the router package. On its own site this
// is plain React Router; inside AQ's website (src/host.js base '/terranotes') what goes IN (Link to, navigate,
// Navigate) gains the prefix and what comes OUT (useLocation) has it stripped, so the rest of the code keeps writing
// its own paths ("/articles/x", to="/photos"). lib/routes.js has the pure helpers; lib/base.js the prefix.
import { forwardRef, useCallback, useMemo } from 'react';
import { Link as RRLink, Navigate as RRNavigate, useLocation as useRRLocation, useNavigate as useRRNavigate } from 'react-router-dom';
import { withBase, stripBase } from './lib/base.js';

export { Routes, Route, useParams, useNavigationType, useSearchParams } from 'react-router-dom';

const prefixed = (to) => {
  if (typeof to === 'string') return withBase(to);
  if (to && typeof to === 'object' && to.pathname != null) return { ...to, pathname: withBase(to.pathname) };
  return to;
};

export const Link = forwardRef(function Link({ to, ...rest }, ref) {
  return <RRLink ref={ref} to={prefixed(to)} {...rest} />;
});

export function Navigate({ to, ...rest }) {
  return <RRNavigate to={prefixed(to)} {...rest} />;
}

export function useLocation() {
  const loc = useRRLocation();
  return useMemo(() => ({ ...loc, pathname: stripBase(loc.pathname) }), [loc]);
}

export function useNavigate() {
  const navigate = useRRNavigate();
  return useCallback((to, opts) => (typeof to === 'number' ? navigate(to) : navigate(prefixed(to), opts)), [navigate]);
}
