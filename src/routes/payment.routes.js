import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { createOrder, verifyPayment, getPaymentStatus } from "../controller/payment.controller.js";

const router = Router();

router.use(verifyJWT);

router.get("/status", getPaymentStatus);
router.post("/create-order", createOrder);
router.post("/verify", verifyPayment);

export default router;