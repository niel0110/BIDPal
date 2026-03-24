import pkg from 'agora-access-token';
const { RtcTokenBuilder, RtcRole, RtmTokenBuilder, RtmRole } = pkg;

// Generate an RTC token for video/audio streaming
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

// Generate an RTM token for real-time chat/messaging
export const generateRtmToken = (req, res) => {
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
        return res.status(500).json({ error: 'Agora credentials not configured' });
    }

    // RTM uid must be a non-empty string
    const { uid } = req.query;
    if (!uid) {
        return res.status(400).json({ error: 'uid is required' });
    }

    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    const token = RtmTokenBuilder.buildToken(
        appId,
        appCertificate,
        String(uid),
        RtmRole.Rtm_User,
        privilegeExpiredTs
    );

    return res.json({ token, appId });
};
