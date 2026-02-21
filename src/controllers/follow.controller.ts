import { Request, Response } from "express";
import followService from "../services/follow.service";

interface Params {
  id: string;
}

/* =========================================================
   TOGGLE FOLLOW
========================================================= */

export const toggleFollow = async (
  req: Request<Params>,
  res: Response
) => {
  const start = Date.now();

  try {
   
    const result = await followService.toggleFollow(
      req.user!.id,
      req.params.id
    );

 

    res.json(result);

  } catch (error: any) {

    

    res.status(500).json({ message: error.message });
  }
};

/* =========================================================
   GET FOLLOWERS
========================================================= */

export const getFollowers = async (
  req: Request<Params>,
  res: Response
) => {
  const page = Number(req.query.page) || 1;

 

  const data = await followService.getFollowers(
    req.params.id,
    page
  );



  res.json(data);
};

/* =========================================================
   GET FOLLOWING
========================================================= */

export const getFollowing = async (
  req: Request<Params>,
  res: Response
) => {
  const page = Number(req.query.page) || 1;

  const data = await followService.getFollowing(
    req.params.id,
    page
  );



  res.json(data);
};

/* =========================================================
   CHECK STATUS
========================================================= */

export const checkStatus = async (
  req: Request<Params>,
  res: Response
) => {


  const data = await followService.isFollowing(
    req.user!.id,
    req.params.id
  );

 

  res.json(data);
};

/* =========================================================
   BLOCK USER
========================================================= */

export const blockUser = async (
  req: Request<Params>,
  res: Response
) => {
  const start = Date.now();

  try {

  

    const result = await followService.blockUser(
      req.user!.id,
      req.params.id
    );


    res.json(result);

  } catch (error: any) {

   

    res.status(500).json({ message: error.message });
  }
};
