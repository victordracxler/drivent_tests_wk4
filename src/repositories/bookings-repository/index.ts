import { prisma } from '@/config';
import { CreateBookingParams } from '@/services/bookings-service';

async function findBooking(userId: number) {
  return prisma.booking.findFirst({
    where: { userId },
    include: { Room: true },
  });
}

async function findRoom(roomId: number) {
  return prisma.room.findFirst({
    where: { id: roomId },
    include: {
      Booking: true,
    },
  });
}

async function createBooking(bookingInfo: CreateBookingParams) {
  return prisma.booking.create({
    data: bookingInfo,
  });
}

async function updateBooking(bookingId: number, bookingInfo: CreateBookingParams) {
  return prisma.booking.update({
    where: { id: bookingId },
    data: bookingInfo,
  });
}

const bookingsRepository = {
  findBooking,
  findRoom,
  createBooking,
  updateBooking,
};

export default bookingsRepository;
