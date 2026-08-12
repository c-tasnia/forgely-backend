import prisma from "../config/prisma.js";
import { userProjectRole } from "../middleware/auth.js";
import { stripPasswords } from "../utils/serialize.js";
import { notify } from "../services/notify.js";

export const createInvite = async (req, res, next) => {
  try {
    const { email, role } = req.body;
    const project = await prisma.project.findUnique({
      where: { id: req.params.projectId },
      include: { members: true },
    });
    if (!project) return res.status(404).json({ message: "Project not found" });

    const requesterRole = userProjectRole(project, req.user.id);
    if (requesterRole !== "owner") {
      return res.status(403).json({ message: "Only the owner can invite members" });
    }

    const invitedUser = await prisma.user.findUnique({ where: { email: (email || "").toLowerCase() } });
    if (!invitedUser) return res.status(404).json({ message: "No user found with that email" });

    const alreadyMember = project.members.some((m) => m.userId === invitedUser.id);
    if (alreadyMember) return res.status(409).json({ message: "User is already a member" });

    const existingInvite = await prisma.invite.findFirst({
      where: { projectId: project.id, invitedUserId: invitedUser.id, status: "pending" },
    });
    if (existingInvite) return res.status(409).json({ message: "Invite already pending for this user" });

    const invite = await prisma.invite.create({
      data: {
        projectId: project.id,
        invitedUserId: invitedUser.id,
        invitedById: req.user.id,
        role: role || "developer",
      },
    });

    notify({
      userId: invitedUser.id,
      type: "invite",
      title: `${req.user.name} invited you to "${project.name}"`,
      body: "Check your invites to accept or decline.",
      link: "/dashboard",
    }).catch(() => {});

    res.status(201).json({ invite });
  } catch (err) {
    next(err);
  }
};

export const getMyInvites = async (req, res, next) => {
  try {
    const invites = await prisma.invite.findMany({
      where: { invitedUserId: req.user.id, status: "pending" },
      include: { project: true, invitedBy: true },
    });
    res.json({ invites: stripPasswords(invites) });
  } catch (err) {
    next(err);
  }
};

export const respondToInvite = async (req, res, next) => {
  try {
    const { action } = req.body; // "accept" | "decline"
    const invite = await prisma.invite.findUnique({ where: { id: req.params.id } });
    if (!invite) return res.status(404).json({ message: "Invite not found" });
    if (invite.invitedUserId !== req.user.id) {
      return res.status(403).json({ message: "This invite is not for you" });
    }
    if (invite.status !== "pending") {
      return res.status(400).json({ message: "Invite already resolved" });
    }

    if (action === "accept") {
      const updated = await prisma.$transaction(async (tx) => {
        const acceptedInvite = await tx.invite.update({ where: { id: invite.id }, data: { status: "accepted" } });
        await tx.projectMember.create({
          data: { projectId: invite.projectId, userId: req.user.id, role: invite.role },
        });
        return acceptedInvite;
      });
      notify({
        userId: invite.invitedById,
        type: "invite_response",
        title: `${req.user.name} accepted your invite`,
        link: `/dashboard/projects/${invite.projectId}`,
      }).catch(() => {});
      return res.json({ invite: updated });
    }

    const declined = await prisma.invite.update({ where: { id: invite.id }, data: { status: "declined" } });
    notify({
      userId: invite.invitedById,
      type: "invite_response",
      title: `${req.user.name} declined your invite`,
      link: `/dashboard/projects/${invite.projectId}`,
    }).catch(() => {});
    res.json({ invite: declined });
  } catch (err) {
    next(err);
  }
};
