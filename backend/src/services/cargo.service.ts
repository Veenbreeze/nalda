import { PersonalShoppingStatus, Prisma, ShipmentStatus, ShipmentType } from '@prisma/client';
import { prisma } from '../config/database';
import { ApiError } from '../utils/errors';
import { generateCargoReference, generateShoppingReference } from '../utils/codes';

// ---------------- Cargo ----------------

export async function listCargo(params: { page: number; limit: number; skip: number; status?: ShipmentStatus; search?: string }) {
  const where: Prisma.CargoShipmentWhereInput = {};
  if (params.status) where.status = params.status;
  if (params.search) {
    where.OR = [
      { cargoReference: { contains: params.search, mode: 'insensitive' } },
      { customer: { fullName: { contains: params.search, mode: 'insensitive' } } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  const [data, total] = await Promise.all([
    prisma.cargoShipment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.limit,
      include: { customer: { select: { id: true, fullName: true, customerCode: true, phone: true } } },
    }),
    prisma.cargoShipment.count({ where }),
  ]);
  return { data, total };
}

export async function createCargo(input: {
  customerId: string;
  shipmentType?: ShipmentType;
  description?: string | null;
  shipmentDate?: string | Date | null;
  estimatedArrival?: string | Date | null;
  notes?: string | null;
  orderId?: string | null;
  weightKg?: number | string | null;
  cost?: number | string | null;
}) {
  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, deletedAt: null } });
  if (!customer) throw ApiError.notFound('Customer not found');
  const cargoReference = await generateCargoReference();
  return prisma.cargoShipment.create({
    data: {
      cargoReference,
      customerId: input.customerId,
      shipmentType: input.shipmentType ?? 'SEA_FREIGHT',
      description: input.description ?? null,
      shipmentDate: input.shipmentDate ? new Date(input.shipmentDate) : null,
      estimatedArrival: input.estimatedArrival ? new Date(input.estimatedArrival) : null,
      notes: input.notes ?? null,
      orderId: input.orderId ?? null,
      weightKg: input.weightKg !== undefined && input.weightKg !== null ? input.weightKg : null,
      cost: input.cost !== undefined && input.cost !== null ? input.cost : null,
    },
    include: { customer: { select: { id: true, fullName: true } } },
  });
}

export async function updateCargo(
  id: string,
  input: {
    shipmentType?: ShipmentType;
    description?: string | null;
    shipmentDate?: string | Date | null;
    estimatedArrival?: string | Date | null;
    actualArrival?: string | Date | null;
    status?: ShipmentStatus;
    notes?: string | null;
    weightKg?: number | string | null;
    cost?: number | string | null;
  },
) {
  const existing = await prisma.cargoShipment.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Cargo shipment not found');
  return prisma.cargoShipment.update({
    where: { id },
    data: {
      ...(input.shipmentType !== undefined ? { shipmentType: input.shipmentType } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.shipmentDate !== undefined
        ? { shipmentDate: input.shipmentDate ? new Date(input.shipmentDate) : null }
        : {}),
      ...(input.estimatedArrival !== undefined
        ? { estimatedArrival: input.estimatedArrival ? new Date(input.estimatedArrival) : null }
        : {}),
      ...(input.actualArrival !== undefined
        ? { actualArrival: input.actualArrival ? new Date(input.actualArrival) : null }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.weightKg !== undefined ? { weightKg: input.weightKg } : {}),
      ...(input.cost !== undefined ? { cost: input.cost } : {}),
    },
    include: { customer: { select: { id: true, fullName: true } } },
  });
}

export async function deleteCargo(id: string) {
  const existing = await prisma.cargoShipment.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Cargo shipment not found');
  await prisma.cargoShipment.delete({ where: { id } });
}

// ---------------- Personal shopping ----------------

export async function listShopping(params: {
  page: number;
  limit: number;
  skip: number;
  status?: PersonalShoppingStatus;
  search?: string;
}) {
  const where: Prisma.PersonalShoppingRequestWhereInput = {};
  if (params.status) where.status = params.status;
  if (params.search) {
    where.OR = [
      { requestNumber: { contains: params.search, mode: 'insensitive' } },
      { productName: { contains: params.search, mode: 'insensitive' } },
      { customer: { fullName: { contains: params.search, mode: 'insensitive' } } },
    ];
  }
  const [data, total] = await Promise.all([
    prisma.personalShoppingRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: params.skip,
      take: params.limit,
      include: { customer: { select: { id: true, fullName: true, customerCode: true, phone: true } } },
    }),
    prisma.personalShoppingRequest.count({ where }),
  ]);
  return { data, total };
}

export async function createShopping(input: {
  customerId: string;
  productName: string;
  productDescription?: string | null;
  referenceImageUrl?: string | null;
  estimatedPrice?: number | string | null;
  notes?: string | null;
}) {
  const customer = await prisma.customer.findFirst({ where: { id: input.customerId, deletedAt: null } });
  if (!customer) throw ApiError.notFound('Customer not found');
  const requestNumber = await generateShoppingReference();
  return prisma.personalShoppingRequest.create({
    data: {
      requestNumber,
      customerId: input.customerId,
      productName: input.productName,
      productDescription: input.productDescription ?? null,
      referenceImageUrl: input.referenceImageUrl ?? null,
      estimatedPrice: input.estimatedPrice ?? null,
      notes: input.notes ?? null,
    },
    include: { customer: { select: { id: true, fullName: true } } },
  });
}

export async function updateShopping(
  id: string,
  input: {
    productName?: string;
    productDescription?: string | null;
    referenceImageUrl?: string | null;
    estimatedPrice?: number | string | null;
    status?: PersonalShoppingStatus;
    notes?: string | null;
  },
) {
  const existing = await prisma.personalShoppingRequest.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Personal shopping request not found');
  return prisma.personalShoppingRequest.update({
    where: { id },
    data: {
      ...(input.productName !== undefined ? { productName: input.productName } : {}),
      ...(input.productDescription !== undefined ? { productDescription: input.productDescription } : {}),
      ...(input.referenceImageUrl !== undefined ? { referenceImageUrl: input.referenceImageUrl } : {}),
      ...(input.estimatedPrice !== undefined ? { estimatedPrice: input.estimatedPrice } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
    include: { customer: { select: { id: true, fullName: true } } },
  });
}

export async function deleteShopping(id: string) {
  const existing = await prisma.personalShoppingRequest.findUnique({ where: { id } });
  if (!existing) throw ApiError.notFound('Personal shopping request not found');
  await prisma.personalShoppingRequest.delete({ where: { id } });
}
