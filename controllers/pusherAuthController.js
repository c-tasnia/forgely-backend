import prisma from "../config/prisma.js";
import pusher from "../config/pusher.js";
import { userProjectRole } from "../middleware/auth.js";

export const authorizeChannel = async (req, res, next) => {
  try {
    const { socket_id: socketId, channel_name: channelName } = req.body;
    if (!socketId || !channelName) {
      return res.status(400).json({ message: "socket_id and channel_name are required" });
    }

    // Private channel for a user's own notifications: private-user-<userId>
    if (channelName.startsWith("private-user-")) {
      const userId = channelName.replace("private-user-", "");
      if (userId !== req.user.id) {
        return res.status(403).json({ message: "You can't subscribe to another user's notification channel" });
      }
      const authResponse = pusher.authorizeChannel(socketId, channelName);
      return res.json(authResponse);
    }

    // Presence channel for a project's chat room: presence-project-<projectId>
    if (channelName.startsWith("presence-project-")) {
      const projectId = channelName.replace("presence-project-", "");
      const project = await prisma.project.findUnique({ where: { id: projectId }, include: { members: true } });
      if (!project || !userProjectRole(project, req.user.id)) {
        return res.status(403).json({ message: "You are not a member of this project" });
      }
      const presenceData = { user_id: req.user.id, user_info: { name: req.user.name } };
      const authResponse = pusher.authorizeChannel(socketId, channelName, presenceData);
      return res.json(authResponse);
    }

    return res.status(400).json({ message: "Unrecognized channel" });
  } catch (err) {
    next(err);
  }
};
