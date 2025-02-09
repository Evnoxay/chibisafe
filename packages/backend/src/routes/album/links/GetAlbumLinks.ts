import type { FastifyRequest, FastifyReply } from 'fastify';
import type { RequestWithUser } from '@/structures/interfaces';
import prisma from '@/structures/database';

export const options = {
	url: '/album/:uuid/links',
	method: 'get',
	middlewares: ['auth']
};

export const run = async (req: RequestWithUser, res: FastifyReply) => {
	const { uuid } = req.params as { uuid?: string };
	if (!uuid) return res.code(400).send({ message: 'Invalid uuid supplied' });

	const album = await prisma.albums.findFirst({
		where: {
			uuid,
			userId: req.user.id
		},
		select: {
			id: true
		}
	});

	if (!album) return res.code(400).send({ message: "Album doesn't exist or doesn't belong to the user" });

	const links = await prisma.links.findMany({
		where: {
			albumId: album.id,
			userId: req.user.id
		},
		select: {
			uuid: true,
			identifier: true,
			views: true,
			enabled: true,
			enableDownload: true,
			expiresAt: true,
			createdAt: true,
			editedAt: true
		}
	});

	return res.send({
		message: 'Successfully retrieved links',
		links
	});
};
