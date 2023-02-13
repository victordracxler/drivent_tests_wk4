import { prisma } from '@/config';
import { Booking } from '@prisma/client';

export async function createNewBooking(params: Partial<Booking> = {}) {
  return prisma.booking.create({
    data: {
      userId: params.userId,
      roomId: params.roomId,
    },
  });
}
