import { useNavigate } from "@solidjs/router";
import { onMount } from "solid-js";
import { ICRC35AsyncRequest, ICRC35Connection, LOGIN_ROUTE, PAY_ROUTE } from "@fort-major/msq-client";
import { IICRC1TransferRequest, ZICRC1TransferRequest } from "@fort-major/msq-shared";
import { z } from "zod";
import { ROOT } from "../../routes";
import { useICRC35Store } from "../../store/icrc-35";

export function ICRC35Page() {
  const navigate = useNavigate();
  const { setIcrc35Request } = useICRC35Store();

  onMount(async () => {
    const connection = await ICRC35Connection.establish({
      mode: "child",
      peer: window.opener,
      connectionFilter: {
        kind: "blacklist",
        list: [],
      },
      debug: import.meta.env.VITE_MSQ_MODE === "DEV",
    });

    const disableHandlers = () => {
      connection.removeRequestHandler(LOGIN_ROUTE, loginHandler);
      connection.removeRequestHandler(PAY_ROUTE, payHandler);
    };

    const loginHandler = (request: ICRC35AsyncRequest<undefined>) => {
      disableHandlers();
      z.undefined().parse(request.payload);

      setIcrc35Request(request);

      window.addEventListener("beforeunload", () => {
        request.respond(false);
        connection.close();
      });

      navigate(ROOT["/"].integration["/"].login.path);
    };

    const payHandler = (request: ICRC35AsyncRequest<IICRC1TransferRequest>) => {
      disableHandlers();
      ZICRC1TransferRequest.parse(request.payload);

      setIcrc35Request(request);

      window.addEventListener("beforeunload", () => {
        request.respond(null);
        connection.close();
      });

      navigate(ROOT["/"].integration["/"].pay.path);
    };

    connection.onRequest(LOGIN_ROUTE, loginHandler);
    connection.onRequest(PAY_ROUTE, payHandler);
  });

  return undefined;
}
