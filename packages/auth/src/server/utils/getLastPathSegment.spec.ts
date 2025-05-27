import { describe, it, expect } from 'vitest';
import { getLastPathSegment } from './getLastPathSegment';

describe('getLastPathSegment', () => {
    it('should return the last segment of a simple path', () => {
        expect(getLastPathSegment('/foo/bar/baz')).toBe('baz');
        expect(getLastPathSegment('foo/bar/baz')).toBe('baz');
    });

    it('should return the last segment when path ends with a slash', () => {
        expect(getLastPathSegment('/foo/bar/baz/')).toBe('baz');
        expect(getLastPathSegment('foo/bar/baz/')).toBe('baz');
    });

    it('should return the last segment for root-level path', () => {
        expect(getLastPathSegment('/foo')).toBe('foo');
        expect(getLastPathSegment('foo')).toBe('foo');
    });

    it('should return empty string for root path', () => {
        expect(getLastPathSegment('/')).toBe('');
        expect(getLastPathSegment('')).toBe('');
    });

    it('should ignore query parameters and fragments', () => {
        expect(getLastPathSegment('/foo/bar?x=1')).toBe('bar');
        expect(getLastPathSegment('/foo/bar#section')).toBe('bar');
        expect(getLastPathSegment('/foo/bar/?q=abc#frag')).toBe('bar');
    });

    it('should handle paths with multiple slashes', () => {
        expect(getLastPathSegment('//foo///bar//baz//')).toBe('baz');
    });
});