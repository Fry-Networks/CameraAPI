import mongoose from 'mongoose';

const metadataSchema = new mongoose.Schema({
  data_type: { type: String, required: true },
}, { _id: false });

const RtspLinkSchema = new mongoose.Schema({
  rtspUrl: { type: String, required: true },
  metadata: metadataSchema,
}, { timestamps: true });

export const RtspLink = mongoose.model('RtspLink', RtspLinkSchema);
