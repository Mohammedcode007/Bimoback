import { Request, Response } from "express";
import friendService from "../services/friend.service";

interface Params {
  id: string;
}

class FriendController {

  async send(req: Request<Params>, res: Response) {
    const data = await friendService.sendRequest(
      req.user!.id,
      req.params.id
    );
    res.json(data);
  }

  async accept(req: Request<Params>, res: Response) {
    const data = await friendService.accept(
      req.user!.id,
      req.params.id
    );
    res.json(data);
  }

  async cancel(req: Request<Params>, res: Response) {
    const data = await friendService.cancelRequest(
      req.user!.id,
      req.params.id
    );
    res.json(data);
  }

  async remove(req: Request<Params>, res: Response) {
    const data = await friendService.remove(
      req.user!.id,
      req.params.id
    );
    res.json(data);
  }

  async block(req: Request<Params>, res: Response) {
    const data = await friendService.block(
      req.user!.id,
      req.params.id
    );
    res.json(data);
  }

  async unblock(req: Request<Params>, res: Response) {
    const data = await friendService.unblock(
      req.user!.id,
      req.params.id
    );
    res.json(data);
  }

  async list(req: Request, res: Response) {
    const data = await friendService.getFriends(
      req.user!.id
    );
    res.json(data);
  }
}

export default new FriendController();
