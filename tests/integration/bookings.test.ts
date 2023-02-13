import app, { init } from '@/app';
import { prisma } from '@/config';
import faker from '@faker-js/faker';
import { TicketStatus } from '@prisma/client';
import e from 'express';
import httpStatus from 'http-status';
import * as jwt from 'jsonwebtoken';
import supertest from 'supertest';
import {
  createEnrollmentWithAddress,
  createUser,
  createTicket,
  createPayment,
  createTicketTypeWithHotel,
  createTicketTypeRemote,
  createHotel,
  createRoomWithHotelId,
  createNewBooking,
} from '../factories';
import { cleanDb, generateValidToken } from '../helpers';

beforeAll(async () => {
  await init();
});

beforeEach(async () => {
  await cleanDb();
});

const server = supertest(app);

describe('GET /booking', () => {
  it('should respond with status 401 if no token is given', async () => {
    const response = await server.get('/booking');

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if given token is not valid', async () => {
    const token = faker.lorem.word();

    const response = await server.get('/booking').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if there is no session for given token', async () => {
    const userWithoutSession = await createUser();
    const token = jwt.sign({ userId: userWithoutSession.id }, process.env.JWT_SECRET);

    const response = await server.get('/booking').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  describe('when token is valid', () => {
    it('should respond with status 404 when user does not have a booking ', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketTypeWithHotel();

      const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
      await createPayment(ticket.id, ticketType.price);

      const response = await server.get('/booking').set('Authorization', `Bearer ${token}`);

      expect(response.status).toEqual(httpStatus.NOT_FOUND);
    });

    it('should respond with status 200 and booking data ', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketTypeWithHotel();
      const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
      await createPayment(ticket.id, ticketType.price);

      const hotel = await createHotel();
      const room = await createRoomWithHotelId(hotel.id);
      const booking = await createNewBooking({ userId: user.id, roomId: room.id });

      const response = await server.get('/booking').set('Authorization', `Bearer ${token}`);

      expect(response.status).toEqual(httpStatus.OK);
      expect(response.body).toEqual({
        id: booking.id,
        userId: user.id,
        roomId: room.id,
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
        Room: {
          id: room.id,
          name: room.name,
          capacity: room.capacity,
          hotelId: hotel.id,
          createdAt: room.createdAt.toISOString(),
          updatedAt: room.updatedAt.toISOString(),
        },
      });
    });
  });
});

describe('POST /booking', () => {
  it('should respond with status 401 if no token is given', async () => {
    const response = await server.post('/booking');

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if given token is not valid', async () => {
    const token = faker.lorem.word();

    const response = await server.post('/booking').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if there is no session for given token', async () => {
    const userWithoutSession = await createUser();
    const token = jwt.sign({ userId: userWithoutSession.id }, process.env.JWT_SECRET);

    const response = await server.post('/booking').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  describe('when token is valid', () => {
    it('should respond with status 400 when body is not given', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);

      const response = await server.post('/booking').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(httpStatus.BAD_REQUEST);
    });

    it('should respond with status 400 when body is not valid', async () => {
      const invalidBody = { [faker.lorem.word()]: faker.lorem.word() };

      const user = await createUser();
      const token = await generateValidToken(user);

      const response = await server.post('/booking').send(invalidBody).set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(httpStatus.BAD_REQUEST);
    });

    describe('when body is valid', () => {
      it('should respond with status 403 when user has no enrollment ', async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        const hotel = await createHotel();
        const room = await createRoomWithHotelId(hotel.id);

        const response = await server
          .post('/booking')
          .send({ roomId: room.id })
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toEqual(httpStatus.FORBIDDEN);
      });

      it('should respond with status 403 when the ticket is RESERVED ', async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        const enrollment = await createEnrollmentWithAddress(user);
        const ticketType = await createTicketTypeWithHotel();

        await createTicket(enrollment.id, ticketType.id, TicketStatus.RESERVED);

        const hotel = await createHotel();
        const room = await createRoomWithHotelId(hotel.id);

        const response = await server
          .post('/booking')
          .send({ roomId: room.id })
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toEqual(httpStatus.FORBIDDEN);
      });

      it('should respond with status 403 when ticket is remote ', async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        const enrollment = await createEnrollmentWithAddress(user);
        const ticketType = await createTicketTypeRemote();

        const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
        await createPayment(ticket.id, ticketType.price);

        const hotel = await createHotel();
        const room = await createRoomWithHotelId(hotel.id);

        const response = await server
          .post('/booking')
          .send({ roomId: room.id })
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toEqual(httpStatus.FORBIDDEN);
      });

      it('should respond with status 403 when room does not have free spaces', async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        const enrollment = await createEnrollmentWithAddress(user);
        const ticketType = await createTicketTypeWithHotel();

        await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

        const hotel = await createHotel();
        const room = await createRoomWithHotelId(hotel.id);

        for (let i = 0; i < room.capacity; i++) {
          const newUser = await createUser();
          await createNewBooking({ userId: newUser.id, roomId: room.id });
        }

        const response = await server
          .post('/booking')
          .send({ roomId: room.id })
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toEqual(httpStatus.FORBIDDEN);
      });

      it('should respond with status 404 when roomId does not exist', async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        const enrollment = await createEnrollmentWithAddress(user);
        const ticketType = await createTicketTypeWithHotel();

        await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

        const hotel = await createHotel();
        const room = await createRoomWithHotelId(hotel.id);

        const response = await server
          .post('/booking')
          .send({ roomId: room.id + 1 })
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toEqual(httpStatus.NOT_FOUND);
      });

      it('should respond with status 200 with bookingId', async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        const enrollment = await createEnrollmentWithAddress(user);
        const ticketType = await createTicketTypeWithHotel();

        const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
        await createPayment(ticket.id, ticketType.price);

        const hotel = await createHotel();
        const room = await createRoomWithHotelId(hotel.id);

        const response = await server
          .post('/booking')
          .send({ roomId: room.id })
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toEqual(httpStatus.OK);
        expect(response.body).toEqual({
          bookingId: expect.any(Number),
        });

        const booking = await prisma.booking.findUnique({
          where: {
            id: response.body.bookingId,
          },
        });

        expect(booking.userId).toBe(user.id);
        expect(booking.roomId).toBe(room.id);
      });
    });
  });
});

describe('PUT /booking/:bookingId', () => {
  it('should respond with status 401 if no token is given', async () => {
    const response = await server.put('/booking/1');

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if given token is not valid', async () => {
    const token = faker.lorem.word();

    const response = await server.put('/booking/1').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it('should respond with status 401 if there is no session for given token', async () => {
    const userWithoutSession = await createUser();
    const token = jwt.sign({ userId: userWithoutSession.id }, process.env.JWT_SECRET);

    const response = await server.put('/booking/1').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  describe('when token is valid', () => {
    it('should respond with status 400 when body is not given', async () => {
      const user = await createUser();
      const token = await generateValidToken(user);

      const response = await server.put('/booking/1').set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(httpStatus.BAD_REQUEST);
    });

    it('should respond with status 400 when body is not valid', async () => {
      const invalidBody = { [faker.lorem.word()]: faker.lorem.word() };

      const user = await createUser();
      const token = await generateValidToken(user);

      const response = await server.put('/booking/1').send(invalidBody).set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(httpStatus.BAD_REQUEST);
    });

    describe('when body is valid', () => {
      it('should respond with status 403 when bookingId does not exist', async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        const enrollment = await createEnrollmentWithAddress(user);
        const ticketType = await createTicketTypeWithHotel();

        await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

        const hotel = await createHotel();
        const room = await createRoomWithHotelId(hotel.id);

        const response = await server
          .put('/booking/1')
          .send({ roomId: room.id })
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toEqual(httpStatus.FORBIDDEN);
      });

      it('should respond with status 403 when booking does not belong to user', async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        const enrollment = await createEnrollmentWithAddress(user);
        const ticketType = await createTicketTypeWithHotel();

        await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

        const hotel = await createHotel();
        const room = await createRoomWithHotelId(hotel.id);
        const newRoom = await createRoomWithHotelId(hotel.id);

        const otherUser = await createUser();

        const wrongBooking = await createNewBooking({ userId: otherUser.id, roomId: room.id });

        const response = await server
          .put(`/booking/${wrongBooking.id}`)
          .send({ roomId: newRoom.id })
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toEqual(httpStatus.FORBIDDEN);
      });

      describe('when bookingId is valid', () => {
        it('should respond with status 404 for inexistent room id', async () => {
          const user = await createUser();
          const token = await generateValidToken(user);
          const enrollment = await createEnrollmentWithAddress(user);
          const ticketType = await createTicketTypeWithHotel();

          await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

          const hotel = await createHotel();
          const room = await createRoomWithHotelId(hotel.id);

          const booking = await createNewBooking({ userId: user.id, roomId: room.id });

          const response = await server
            .put(`/booking/${booking.id}`)
            .send({ roomId: room.id + 1 })
            .set('Authorization', `Bearer ${token}`);

          expect(response.status).toEqual(httpStatus.NOT_FOUND);
        });

        it('should respond with status 403 when new room is full', async () => {
          const user = await createUser();
          const token = await generateValidToken(user);
          const enrollment = await createEnrollmentWithAddress(user);
          const ticketType = await createTicketTypeWithHotel();

          await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

          const hotel = await createHotel();
          const room = await createRoomWithHotelId(hotel.id);

          const booking = await createNewBooking({ userId: user.id, roomId: room.id });
          const newRoom = await createRoomWithHotelId(hotel.id);

          for (let i = 0; i < room.capacity; i++) {
            const newUser = await createUser();
            await createNewBooking({ userId: newUser.id, roomId: newRoom.id });
          }
          const response = await server
            .put(`/booking/${booking.id}`)
            .send({ roomId: newRoom.id })
            .set('Authorization', `Bearer ${token}`);

          expect(response.status).toEqual(httpStatus.FORBIDDEN);
        });

        it('should respond with status 200 with booking id', async () => {
          const user = await createUser();
          const token = await generateValidToken(user);
          const enrollment = await createEnrollmentWithAddress(user);
          const ticketType = await createTicketTypeWithHotel();

          const ticket = await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
          await createPayment(ticket.id, ticketType.price);

          const hotel = await createHotel();
          const room = await createRoomWithHotelId(hotel.id);

          const booking = await createNewBooking({ userId: user.id, roomId: room.id });
          const newRoom = await createRoomWithHotelId(hotel.id);

          const response = await server
            .put(`/booking/${booking.id}`)
            .send({ roomId: newRoom.id })
            .set('Authorization', `Bearer ${token}`);

          expect(response.status).toEqual(httpStatus.OK);
          expect(response.body).toEqual({
            bookingId: booking.id,
          });

          const bookingEdited = await prisma.booking.findUnique({
            where: {
              id: response.body.bookingId,
            },
          });

          expect(bookingEdited.userId).toBe(user.id);
          expect(bookingEdited.roomId).toBe(newRoom.id);
        });
      });
    });
  });
});
