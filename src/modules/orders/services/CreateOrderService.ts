import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(

    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) { }

  public async execute({ customer_id, products }: IRequest): Promise<Order> {

    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('Não existe cliente com este ID');
    }

    const existentProducts = await this.productsRepository.findAllById(
      products,
    )

    if (!existentProducts.length) {
      throw new AppError('Não existe produto com este ID');
    }

    const existentProductsIds = existentProducts.map(product => product.id)

    const checkInexistentProduct = products.filter(
      product => !existentProductsIds.includes(product.id),
    )

    if (checkInexistentProduct.length) {
      throw new AppError(`Não encontramos o(s) produto(s) ${checkInexistentProduct[0].id}`)
    }

    const findProdcutsWithNoQuantityAvailable = products.filter(
      product =>
        existentProducts.filter(p => p.id == product.id)[0].quantity < product.quantity
    )

    if (findProdcutsWithNoQuantityAvailable.length) {
      throw new AppError(`A quantidade ${findProdcutsWithNoQuantityAvailable[0].quantity} não é permitida para ${findProdcutsWithNoQuantityAvailable[0].id}`)
    }

    const seriealizedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existentProducts.filter(p => p.id == product.id)[0].price,
    }))

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: seriealizedProducts,
    })


    const { order_products } = order;

    const orderedProductsQuantity = order_products.map(product => ({
      id: product.product_id,
      quantity:
        existentProducts.filter(p => p.id == product.product_id)[0].quantity - product.quantity

    }));


    await this.productsRepository.updateQuantity(orderedProductsQuantity);

    return order;

  }


}

export default CreateOrderService;
