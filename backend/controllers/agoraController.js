import { RtcTokenBuilder, RtcRole } from 'agora-access-token';

export const generateToken = (req, res) => {
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
        return res.status(500).json({ error: 'Agora credentials not configured' });
    }

    const { channelName, uid = 0, role = 'audience' } = req.query;

    if (!channelName) {
        return res.status(400).json({ error: 'channelName is required' });
    }

    const rtcRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        Number(uid),
        rtcRole,
        privilegeExpiredTs
    );

    return res.json({ token, appId, channel: channelName });
};
