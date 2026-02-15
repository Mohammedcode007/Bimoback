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
    console.log("==================================");
    console.log("🔁 FOLLOW REQUEST");
    console.log("👤 User:", req.user?.id);
    console.log("🎯 Target:", req.params.id);

    const result = await followService.toggleFollow(
      req.user!.id,
      req.params.id
    );

    console.log("✅ Follow Result:", result);
    console.log("⏱ Duration:", Date.now() - start, "ms");
    console.log("==================================");

    res.json(result);

  } catch (error: any) {

    console.log("==================================");
    console.log("❌ FOLLOW ERROR");
    console.log("👤 User:", req.user?.id);
    console.log("🎯 Target:", req.params.id);
    console.log("💥 Error:", error.message);
    console.log("⏱ Duration:", Date.now() - start, "ms");
    console.log("==================================");

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

  console.log("==================================");
  console.log("👥 GET FOLLOWERS");
  console.log("🎯 Target:", req.params.id);
  console.log("📄 Page:", page);

  const data = await followService.getFollowers(
    req.params.id,
    page
  );

  console.log("✅ Followers Count:", data.length);
  console.log("==================================");

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

  console.log("==================================");
  console.log("➡️ GET FOLLOWING");
  console.log("👤 User:", req.params.id);
  console.log("📄 Page:", page);

  const data = await followService.getFollowing(
    req.params.id,
    page
  );

  console.log("✅ Following Count:", data.length);
  console.log("==================================");

  res.json(data);
};

/* =========================================================
   CHECK STATUS
========================================================= */

export const checkStatus = async (
  req: Request<Params>,
  res: Response
) => {
  console.log("==================================");
  console.log("🔎 CHECK FOLLOW STATUS");
  console.log("👤 User:", req.user?.id);
  console.log("🎯 Target:", req.params.id);

  const data = await followService.isFollowing(
    req.user!.id,
    req.params.id
  );

  console.log("📌 isFollowing:", data.isFollowing);
  console.log("==================================");

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

    console.log("==================================");
    console.log("⛔ BLOCK USER");
    console.log("👤 User:", req.user?.id);
    console.log("🎯 Target:", req.params.id);

    const result = await followService.blockUser(
      req.user!.id,
      req.params.id
    );

    console.log("✅ Block Result:", result);
    console.log("⏱ Duration:", Date.now() - start, "ms");
    console.log("==================================");

    res.json(result);

  } catch (error: any) {

    console.log("==================================");
    console.log("❌ BLOCK ERROR");
    console.log("👤 User:", req.user?.id);
    console.log("🎯 Target:", req.params.id);
    console.log("💥 Error:", error.message);
    console.log("⏱ Duration:", Date.now() - start, "ms");
    console.log("==================================");

    res.status(500).json({ message: error.message });
  }
};
