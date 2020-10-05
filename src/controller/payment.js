const helper = require("../helper/index.js");
const midTransClient = require("midtrans-client");

const { createPayment } = require("../model/payment");
const { postTopup, getAllTopup } = require("../model/topup");
const { checkNumber } = require("../model/user");
const { patchUser } = require("../model/profile");
const { postTransaction } = require("../model/transfer");

module.exports = {
  getTopupData: async (request, response) => {
    try {
      const data = await getAllTopup();
      return helper.response(response, 200, "Success Get Topup Data !", data);
    } catch (error) {
      return helper.response(response, 400, "Bad Request", error);
    }
  },
  postPayment: async (request, response) => {
    try {
      // ==========NOMIDTRANS============
      // model1
      //proses to database TOPUP
      // set data topupid,userId,nominal,created_at
      //   model2
      // update ke table user:user_saldo
      //   ===========MIDTRANS=========
      // model1
      //proses to database TOPUP
      // set data topupid,userId,nominal,status,created_at
      //   result
      const { id_topup, nominal } = request.body;
      const topUp = await createPayment(id_topup, nominal);
      return helper.response(response, 200, "Success Create Payment !", topUp);
    } catch (error) {
      return helper.response(response, 400, "Bad Request", error);
    }
  },
  postMidtransNotif: async (request, response) => {
    console.log("halo123");
    const { user_id, user_phone, nominal } = request.body;
    let snap = new midTransClient.Snap({
      isProduction: false,
      serverKey: "SB-Mid-server-HUqP4K69c5VLR3DURHKmoGpD",
      clientKey: "SB-Mid-client-tNYBiZTwn--3VTLB",
    });

    snap.transaction
      .notification(request.body)
      .then(async (statusResponse) => {
        let orderId = statusResponse.order_id;
        let transactionStatus = statusResponse.transaction_status;
        let fraudStatus = statusResponse.fraud_status;

        console.log(
          `Transaction notification received. Order ID: ${orderId}. Transaction status: ${transactionStatus}. Fraud status: ${fraudStatus}`
        );

        // Sample transactionStatus handling logic

        if (transactionStatus == "capture") {
          // capture only applies to card transaction, which you need to check for the fraudStatus
          if (fraudStatus == "challenge") {
            // TODO set transaction status on your databaase to 'challenge'
          } else if (fraudStatus == "accept") {
            // TODO set transaction status on your databaase to 'success'
          }
        } else if (transactionStatus == "settlement") {
          const setData = {
            user_id,
            topup_nominal: nominal,
            created_at: new Date(),
          };

          const checkUser = await checkNumber(user_phone);
          const setData2 = {
            user_saldo: Number(nominal) + Number(checkUser[0].user_saldo),
          };
          const setData3 = {
            user_id: 1,
            target_id: user_id,
            trans_type: "Top up",
            trans_nominal: nominal,
            created_at: new Date(),
            trans_status: chance === 1 ? "success" : null,
          };
          try {
            if (checkUser.length > 0) {
              const result = await postTopup(setData);
              const result2 = await patchUser(setData2, user_id);
              const result3 = await postTransaction(setData3);
              return helper.response(
                response,
                200,
                "Top up success",
                result,
                result2,
                result3
              );
            } else {
              return helper.response(response, 400, "Invalid phone number");
            }
          } catch (error) {
            return helper.response(response, 400, "Bad Request", error);
          }
          // TODO set transaction status on your databaase to 'success'
          // [model 1] UPDATE STATUS KE DATABASE dengan status berhasil
          // const updateStatusResult = await modelUpdateStatusResult(orderId, transactionStatus)
          // response user_id, nominal topup
          // ====================
          // [model 2] cek nominal sebelumnya dan akan set parameter (user_id)
          // response nominal sebelum toup
          // ====================
          // saldoBaru = nominal sebelumnya + nominal topup
          // [model 3] UPDATE DATA SALDO SUPAYA SALDO USER BERTAMBAH (user_id, saldoBaru)
        } else if (transactionStatus == "deny") {
          // TODO you can ignore 'deny', because most of the time it allows payment retries
          // and later can become success
        } else if (
          transactionStatus == "cancel" ||
          transactionStatus == "expire"
        ) {
          // TODO set transaction status on your databaase to 'failure'
        } else if (transactionStatus == "pending") {
          // TODO set transaction status on your databaase to 'pending' / waiting payment
        }
      })
      .then(() => {
        return helper.response(response, 200, "OK");
      })
      .catch((error) => {
        return helper.response(response, 200, error);
      });
  },
};
