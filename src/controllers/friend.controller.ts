import { Request, Response } from "express";
import friendService from "../services/friend.service";

interface Params {
  id: string;
}

class FriendController {

  /* ================= SEND REQUEST ================= */

  async send(req: Request<Params>, res: Response) {
    try {

      const currentUserId = req.user!.id;
      const targetUserId = req.params.id;

      const data = await friendService.sendRequest(
        currentUserId,
        targetUserId
      );

      res.json(data);

    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }


  /* ================= ACCEPT REQUEST ================= */

  async accept(req: Request<Params>, res: Response) {
    try {

      const currentUserId = req.user!.id;
      const targetUserId = req.params.id;

      const data = await friendService.accept(
        currentUserId,
        targetUserId
      );

      res.json(data);

    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }


  /* ================= REJECT REQUEST ================= */

  async reject(req: Request<Params>, res: Response) {
    try {

      const currentUserId = req.user!.id;
      const targetUserId = req.params.id;

      const data = await friendService.reject(
        currentUserId,
        targetUserId
      );

      res.json(data);

    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }


  /* ================= CANCEL REQUEST ================= */

  async cancel(req: Request<Params>, res: Response) {
    try {

      const currentUserId = req.user!.id;
      const targetUserId = req.params.id;

      const data = await friendService.cancelRequest(
        currentUserId,
        targetUserId
      );

      res.json(data);

    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }


  /* ================= REMOVE FRIEND ================= */

  async remove(req: Request<Params>, res: Response) {
    try {

      const currentUserId = req.user!.id;
      const targetUserId = req.params.id;

      const data = await friendService.remove(
        currentUserId,
        targetUserId
      );

      res.json(data);

    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }


  /* ================= BLOCK USER ================= */

  async block(req: Request<Params>, res: Response) {
    try {

      const currentUserId = req.user!.id;
      const targetUserId = req.params.id;

      const data = await friendService.block(
        currentUserId,
        targetUserId
      );

      res.json(data);

    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }


  /* ================= UNBLOCK USER ================= */

  async unblock(req: Request<Params>, res: Response) {
    try {

      const currentUserId = req.user!.id;
      const targetUserId = req.params.id;

      const data = await friendService.unblock(
        currentUserId,
        targetUserId
      );

      res.json(data);

    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }


  /* ================= GET FRIENDS ================= */

  async list(req: Request, res: Response) {
    try {

      const currentUserId = req.user!.id;

      const data = await friendService.getFriends(currentUserId);

      res.json(data);

    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}

export default new FriendController();
