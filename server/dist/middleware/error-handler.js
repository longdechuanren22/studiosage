export function errorHandler(err, _req, res, _next) {
    console.error('[StudioSage Error]', err.message, err.stack?.split('\n').slice(0, 3).join('\n'));
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
}
export function notFound(_req, res) {
    res.status(404).json({ error: 'Not found' });
}
