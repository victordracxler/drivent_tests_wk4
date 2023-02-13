import { Router } from 'express';
import { authenticateToken, validateBody } from '@/middlewares';
import { createBookingSchema } from '@/schemas/booking-schema';
import { getBooking, postBooking, updateBooking } from '@/controllers';

const bookingsRouter = Router();

bookingsRouter
  .all('/*', authenticateToken)
  .get('/', getBooking)
  .post('/', validateBody(createBookingSchema), postBooking)
  .put('/:bookingId', updateBooking);

export { bookingsRouter };
