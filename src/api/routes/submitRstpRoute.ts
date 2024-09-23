import express from 'express';
import { RtspLink } from '../../db/models/rtsp_schema.js';
import { checkRtspLink } from '../../service/checkRtspLink.js';

const router = express.Router();

router.post('/api/validateRtsp', async (req, res) => {
  const { rtspUrl,minerKey,address } = req.body;

  if (!rtspUrl) {
    return res.status(400).json({
      status: 'ERROR',
      message: 'RTSP URL is required',
    });
  }

  const existingKey = await RtspLink.exists({ rtspUrl: rtspUrl });

    if (existingKey) {
      console.log("existingKey:", existingKey);
      return res.status(409).send({
        message: "RTSP URL already exists in database.",
        status: "ERROR"
      });
    }

  try {
    const isValid = await checkRtspLink(rtspUrl);

    if (isValid) {
      const rtspLink = new RtspLink({
        rtspUrl,
        minerKey,
        walletAddress: address,
        metadata: {
          data_type: "rstp",
        }
      });
      await rtspLink.save();

      return res.status(200).json({
        status: 'SUCCESS',
        message: 'RTSP link is valid and accessible',
      });
    } else {
      return res.status(400).json({
        status: 'ERROR',
        message: 'RTSP link is invalid or not accessible',
      });
    }
  } catch (error: any) {
    console.error('Error validating RTSP link:', error);
    return res.status(500).json({
      status: 'ERROR',
      message: 'Failed to validate RTSP link',
      error: error.message,
    });
  }
});

export default router;
