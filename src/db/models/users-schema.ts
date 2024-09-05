import mongoose, { mongo } from 'mongoose';

export const usersSchema = new mongoose.Schema({
    address: { type: String, required: true },
    byod: {
        licenses: { type: [String], default: [] },
        payments: { type: [Date], default: [] }
    }
});

export interface User extends mongoose.Document {
    address: string,
    byod: {
        licenses: string[],
        payments: Date[]
    }
}

export const UserModel = mongoose.model<User>('users', usersSchema);

export async function getUserByAddress(address: string): Promise<User> {
    let user = await UserModel.findOne({ address: address });
    if (!user) user = await UserModel.create({ address: address});
    return user;
}