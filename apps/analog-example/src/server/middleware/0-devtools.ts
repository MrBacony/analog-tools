import { defineEventHandler, getRequestURL, H3Event, sendRedirect } from 'h3';

/**
 * Authentication middleware for protected API routes
 * To be used with Analog.js middleware structure
 */
export default defineEventHandler(async (event: H3Event) => {
  const pathname = getRequestURL(event).pathname;

  // Check if the request is for a protected route
  if (pathname.includes('/.well-known/appspecific/com.chrome.devtools.json')) {
    // Call the authentication function
    await sendRedirect(event, '/');
  }
  // If not a protected route, continue with the request
  return;
});
