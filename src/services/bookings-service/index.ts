import { cannotCreateBookingError, notFoundError } from '@/errors';
import bookingsRepository from '@/repositories/bookings-repository';
import enrollmentRepository from '@/repositories/enrollment-repository';
import ticketRepository from '@/repositories/ticket-repository';
import { Booking, TicketStatus } from '@prisma/client';

async function findBookingService(userId: number) {
  const booking = await bookingsRepository.findBooking(userId);

  if (!booking) {
    throw notFoundError();
  }
  return booking;
}

async function createBookingService(bookingInfo: CreateBookingParams) {
  const userEnrolled = await enrollmentRepository.findWithAddressByUserId(bookingInfo.userId);

  if (!userEnrolled) {
    throw notFoundError();
  }

  const ticket = await ticketRepository.findTicketByEnrollmentId(userEnrolled.id);

  if (
    !ticket ||
    ticket.TicketType.isRemote ||
    ticket.status === TicketStatus.RESERVED ||
    !ticket.TicketType.includesHotel
  ) {
    throw cannotCreateBookingError();
  }

  const room = await bookingsRepository.findRoom(bookingInfo.roomId);

  if (!room) {
    throw notFoundError();
  }

  if (room.capacity === room.Booking.length) {
    throw cannotCreateBookingError();
  }

  const booking = await bookingsRepository.createBooking(bookingInfo);
  return booking;
}

export type CreateBookingParams = Pick<Booking, 'roomId' | 'userId'>;

const bookingsService = {
  findBookingService,
  createBookingService,
};

export default bookingsService;
