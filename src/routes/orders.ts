import * as express from "express";
const router = express.Router();
import { AppDataSource } from "../database/data-source";
import { Order } from "../entity/Order";
import { User } from "../entity/User";
import { Product } from "../entity/Product";
import * as jwt from "jsonwebtoken";
import { tokenVerification } from "../middlewares/authMiddleware";
import { CouponCode } from "../entity/CouponCode";

const ordersRepository = AppDataSource.getRepository(Order);
const usersRepository = AppDataSource.getRepository(User);
const productsRepository = AppDataSource.getRepository(Product);
const couponRepository = AppDataSource.getRepository(CouponCode);

router.post("/", async (request, response) => {
  const body = request.body;
  const { userID, products: productsIDArray } = body;

  let newOrder = new Order();

  const assignedUser = await usersRepository.findOneBy({ id: userID });

  let findCoupon = await couponRepository.findOneBy({ code: body.couponCode });

  let sum = 0;

  let productsArray = await Promise.all(
    productsIDArray.map(async (el) => {
      let productsByID = await productsRepository.findOneBy({
        id: el.id,
      });

      let countOfQuantity = el.quantity;

      let discountedPrice = productsByID.discountedPrice * countOfQuantity;

      sum += discountedPrice;
      return productsByID;
    })
  );

  let valueOfCoupon = findCoupon.value; // liczba
  let percentageValueOfCoupon = findCoupon.percentageValue; // procent

  let newSumValue = sum - valueOfCoupon; //liczba
  let mathSumPercentageValue = (sum * percentageValueOfCoupon) / 100; // procent
  let newSumPercentageValue = sum - mathSumPercentageValue;

  if (body.couponCode && findCoupon.value) {
    newOrder.price = newSumValue;
  } else if (body.couponCode && findCoupon.percentageValue) {
    newOrder.price = newSumPercentageValue;
  } else {
    newOrder.price = sum;
  }

  newOrder.createDate = body.createDate;
  newOrder.updateDate = body.updateDate;
  newOrder.couponCode = body.couponCode;
  newOrder.status = "in realization";
  newOrder.user = assignedUser;
  newOrder.products = productsArray;

  const addedOrder = await AppDataSource.manager.save(newOrder);

  response.status(201).json({
    status: "created",
    message: addedOrder,
  });
});

router.use((request, response, next) => {
  tokenVerification(request, response, next);
});

router.get("/", async (request, response) => {
  const [orders, count] = await ordersRepository.findAndCount();

  response.status(200).json({
    status: "Success",
    message: {
      orders,
      count,
    },
  });
});

router.get("/:id", async (request, response) => {
  const orderID = +request.params.id;

  const order = await ordersRepository.find({
    where: { id: orderID },
    relations: { user: true, products: true },
  });

  // const order = await ordersRepository
  //   .createQueryBuilder("order")
  //   .where("order.id = :id", { id: orderID })
  //   .leftJoinAndSelect("order.user", "user")
  //   .getOne();

  response.status(200).json({
    status: "success",
    message: order,
  });
});

router.delete("/:id", async (request, response) => {
  const orderID = +request.params.id;

  const deletedOrder = await ordersRepository.delete(orderID);

  response.status(200).json({
    status: "success",
    message: deletedOrder,
  });
});

router.put("/:id", async (request, response) => {
  const { userID, productsIDs, ...rest } = request.body;
  const orderID = +request.params.id;
  const arrayOfProducts = productsIDs.map((el) => ({ id: el }));

  let orderToUpdate = await ordersRepository.findOneBy({ id: orderID });

  orderToUpdate = {
    ...orderToUpdate,
    ...rest,
    id: orderID,
    user: { id: userID },
    products: arrayOfProducts,
  };

  const updatedOrder = await ordersRepository.save(orderToUpdate);

  response.status(200).json({
    status: "order updated",
    message: updatedOrder,
  });
});

export default router;
