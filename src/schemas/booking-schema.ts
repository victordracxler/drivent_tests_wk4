import { CreateBookingParams } from '@/services/bookings-service';
import Joi from 'joi';

export const createBookingSchema = Joi.object<CreateBookingParams>({
  roomId: Joi.number().min(1).required(),
});
