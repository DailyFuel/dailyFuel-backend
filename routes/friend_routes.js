import { Router } from "express";
import auth from "../src/auth.js";
import User from "../models/user.js";
import FriendChallenge from "../models/friend_challenge.js";
import { createNotification } from "../services/notification_service.js";

console.log('=== FRIEND ROUTES LOADING ===');
console.log('Routes to be registered:');
console.log('- GET /friends/test');
console.log('- GET /friends/friends');
console.log('- PUT /friends/request/:requestId/accept');
console.log('- PUT /friends/request/:requestId/decline');
console.log('- DELETE /friends/cancel-request/:requestId');
console.log('=== FRIEND ROUTES LOADED ===');

const router = Router();

// Test route to verify friend routes are loaded
router.get('/test', (req, res) => {
  console.log('=== FRIEND TEST ROUTE HIT ===');
  res.json({ 
    message: 'Friend routes are working!',
    timestamp: new Date().toISOString(),
    routes: [
      '/friends/test',
      '/friends/friends',
      '/friends/search',
      '/friends/request/:userId',
      '/friends/request/:requestId/accept',
      '/friends/request/:requestId/decline',
      '/friends/outgoing-requests',
      '/friends/cancel-request/:requestId',
      '/friends/remove/:friendId'
    ]
  });
});

// Add this right after the test route
router.get('/debug', (req, res) => {
  console.log('=== FRIEND DEBUG ROUTE HIT ===');
  res.json({ 
    message: 'Friend routes are working!',
    timestamp: new Date().toISOString(),
    availableRoutes: [
      'GET /friends/test',
      'GET /friends/debug',
      'GET /friends/friends',
      'PUT /friends/request/:requestId/accept',
      'PUT /friends/request/:requestId/decline',
      'DELETE /friends/cancel-request/:requestId',
      'DELETE /friends/remove/:friendId'
    ]
  });
});

// Get user's friends and pending requests
router.get("/friends", auth, async (req, res) => {
  try {
    const user = await User.findById(req.auth.id)
      .populate('friends', 'name email publicProfile')
      .populate('friendRequests.from', 'name email publicProfile');

    const friends = user.friends || [];
    const pendingRequests = user.friendRequests?.filter(req => req.status === 'pending') || [];

    res.send({
      friends,
      pendingRequests
    });
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

// Get outgoing friend requests (requests you've sent)
router.get("/outgoing-requests", auth, async (req, res) => {
  try {
    const currentUserId = req.auth.id;
    
    // Find all users who have received friend requests from the current user
    const usersWithRequests = await User.find({
      'friendRequests.from': currentUserId,
      'friendRequests.status': 'pending'
    })
    .select('name email publicProfile friendRequests')
    .populate('friendRequests.from', 'name email publicProfile');

    const outgoingRequests = usersWithRequests
      .map(user => {
        const request = user.friendRequests.find(req => 
          req.from.toString() === currentUserId && req.status === 'pending'
        );
        
        // Only include if request exists
        if (request) {
          return {
            _id: request._id,
            to: {
              _id: user._id,
              name: user.name,
              email: user.email,
              publicProfile: user.publicProfile
            },
            status: request.status,
            createdAt: request.createdAt
          };
        }
        return null;
      })
      .filter(request => request !== null); // Remove null entries

    res.send({ outgoingRequests });
  } catch (err) {
    console.error('Outgoing requests error:', err);
    res.status(400).send({ error: err.message });
  }
});

// Search users for friend requests
router.get('/search', auth, async (req, res) => {
  console.log('=== SEARCH ROUTE HIT ===');
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);
  console.log('Query params:', req.query);
  console.log('Auth user ID:', req.auth.id);
  
  try {
    const { q } = req.query;
    const currentUserId = req.auth.id;

    console.log('Search request received:', { q, currentUserId });

    if (!q || q.length < 2) {
      console.log('Query too short, returning error');
      return res.status(400).send({ error: 'Search query must be at least 2 characters' });
    }

    // Search users by name or email, excluding the current user and existing friends
    const currentUser = await User.findById(currentUserId);
    console.log('Current user found:', !!currentUser);
    
    const existingFriendIds = currentUser.friends || [];

    // Find all matching users (including those with pending requests)
    const allUsers = await User.find({
      $and: [
        { _id: { $ne: currentUserId } }, // Exclude current user
        { _id: { $nin: existingFriendIds } }, // Exclude existing friends
        {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { email: { $regex: q, $options: 'i' } }
          ]
        }
      ]
    })
    .select('name email publicProfile friendRequests')
    .limit(10);

    console.log('All users found:', allUsers.length);
    console.log('Current user friend requests:', currentUser.friendRequests);

    // Process users to include request status
    const usersWithStatus = allUsers.map(user => {
      console.log(`Processing user: ${user.email}`);
      console.log(`User friend requests:`, user.friendRequests);
      
      // Check if current user has sent a request to this user
      const outgoingRequest = user.friendRequests.find(
        req => req.from.toString() === currentUserId.toString() && req.status === 'pending'
      );
      console.log(`Outgoing request found:`, !!outgoingRequest);

      // Check if this user has sent a request to current user
      const incomingRequest = currentUser.friendRequests.find(
        req => req.from.toString() === user._id.toString() && req.status === 'pending'
      );
      console.log(`Incoming request found:`, !!incomingRequest);

      let requestStatus = null;
      if (outgoingRequest) {
        requestStatus = 'pending_outgoing';
        console.log(`Setting status to pending_outgoing for ${user.email}`);
      } else if (incomingRequest) {
        requestStatus = 'pending_incoming';
        console.log(`Setting status to pending_incoming for ${user.email}`);
      }

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        publicProfile: user.publicProfile,
        requestStatus
      };
    });

    console.log('Search results found:', usersWithStatus.length);
    console.log('Users with status:', usersWithStatus.map(u => ({ 
      name: u.name, 
      email: u.email, 
      requestStatus: u.requestStatus 
    })));
    
    res.send({ users: usersWithStatus });
  } catch (err) {
    console.error('Search error:', err);
    res.status(400).send({ error: err.message });
  }
});

// Send friend request
router.post("/request/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const fromUserId = req.auth.id;

    console.log('=== SEND FRIEND REQUEST ===');
    console.log('From user ID:', fromUserId);
    console.log('To user ID:', userId);

    // Prevent self-friend requests
    if (fromUserId === userId) {
      console.log('Self-friend request attempted');
      return res.status(400).send({ error: "You cannot send a friend request to yourself" });
    }

    // Check if users exist
    const [fromUser, toUser] = await Promise.all([
      User.findById(fromUserId),
      User.findById(userId)
    ]);

    if (!fromUser || !toUser) {
      console.log('User not found:', { fromUser: !!fromUser, toUser: !!toUser });
      return res.status(404).send({ error: "User not found" });
    }

    console.log('Users found:', { fromUser: fromUser.email, toUser: toUser.email });

    // Check if already friends
    if (fromUser.friends.includes(userId)) {
      console.log('Already friends');
      return res.status(400).send({ error: "Already friends" });
    }

    console.log('To user friend requests:', toUser.friendRequests.map(req => ({
      from: req.from.toString(),
      status: req.status,
      createdAt: req.createdAt
    })));

    // Check if request already exists
    const existingRequest = toUser.friendRequests.find(
      req => req.from.toString() === fromUserId
    );

    console.log('Existing request found:', !!existingRequest);
    if (existingRequest) {
      console.log('Existing request details:', {
        from: existingRequest.from.toString(),
        status: existingRequest.status,
        createdAt: existingRequest.createdAt
      });
      return res.status(400).send({ error: "Friend request already sent" });
    }

    console.log('No existing request found, creating new request');

    // Add friend request
    toUser.friendRequests.push({
      from: fromUserId,
      status: 'pending',
      createdAt: new Date()
    });

    await toUser.save();
    console.log('Friend request saved successfully');

    // Create notification for the recipient
    await createNotification(userId, "social_activity", {
      title: "New Friend Request",
      message: `${fromUser.name || fromUser.email} sent you a friend request`,
      data: {
        type: "friend_request",
        fromUserId: fromUserId,
        fromUserName: fromUser.name || fromUser.email,
        requestId: toUser.friendRequests[toUser.friendRequests.length - 1]._id
      }
    });

    console.log('Notification created');

    res.send({ 
      message: "Friend request sent successfully",
      requestId: toUser.friendRequests[toUser.friendRequests.length - 1]._id
    });
  } catch (err) {
    console.error('Send friend request error:', err);
    res.status(400).send({ error: err.message });
  }
});

// Accept friend request
router.put("/request/:requestId/accept", auth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUserId = req.auth.id;

    // Find user with the request
    const user = await User.findOne({
      'friendRequests._id': requestId,
      'friendRequests.from': { $ne: currentUserId } // Request is not from current user
    });

    if (!user) {
      return res.status(404).send({ error: "Friend request not found" });
    }

    const request = user.friendRequests.find(req => req._id.toString() === requestId);
    if (!request || request.status !== 'pending') {
      return res.status(400).send({ error: "Invalid request" });
    }

    // Get the sender's user info
    const sender = await User.findById(request.from);
    if (!sender) {
      return res.status(404).send({ error: "Sender not found" });
    }

    // Update request status to accepted
    request.status = 'accepted';

    // Add to friends list for both users
    if (!user.friends.includes(request.from)) {
      user.friends.push(request.from);
    }
    if (!sender.friends.includes(user._id)) {
      sender.friends.push(user._id);
    }

    // Remove the friend request from both users' arrays
    await Promise.all([
      User.findByIdAndUpdate(user._id, {
        $pull: { friendRequests: { _id: requestId } }
      }),
      User.findByIdAndUpdate(sender._id, {
        $pull: { friendRequests: { _id: requestId } }
      })
    ]);

    // Create notification for the sender
    await createNotification(request.from, "social_activity", {
      title: "Friend Request Accepted",
      message: `${user.name || user.email} accepted your friend request`,
      data: {
        type: "friend_request_accepted",
        acceptedByUserId: user._id,
        acceptedByUserName: user.name || user.email
      }
    });

    res.send({ message: "Friend request accepted" });
  } catch (err) {
    console.error('Accept friend request error:', err);
    res.status(400).send({ error: err.message });
  }
});

// Decline friend request
router.put("/request/:requestId/decline", auth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUserId = req.auth.id;

    // Find user with the request
    const user = await User.findOne({
      'friendRequests._id': requestId,
      'friendRequests.from': { $ne: currentUserId } // Request is not from current user
    });

    if (!user) {
      return res.status(404).send({ error: "Friend request not found" });
    }

    const request = user.friendRequests.find(req => req._id.toString() === requestId);
    if (!request || request.status !== 'pending') {
      return res.status(400).send({ error: "Invalid request" });
    }

    // Get the sender's user info
    const sender = await User.findById(request.from);
    if (!sender) {
      return res.status(404).send({ error: "Sender not found" });
    }

    // Remove the friend request from both users' arrays
    await Promise.all([
      User.findByIdAndUpdate(user._id, {
        $pull: { friendRequests: { _id: requestId } }
      }),
      User.findByIdAndUpdate(sender._id, {
        $pull: { friendRequests: { _id: requestId } }
      })
    ]);

    res.send({ message: "Friend request declined" });
  } catch (err) {
    console.error('Decline friend request error:', err);
    res.status(400).send({ error: err.message });
  }
});

// Cancel a friend request
router.delete("/cancel-request/:requestId", auth, async (req, res) => {
  try {
    const { requestId } = req.params;
    const currentUserId = req.auth.id;

    // Find the user who received the request and remove it
    const userWithRequest = await User.findOne({
      'friendRequests._id': requestId,
      'friendRequests.from': currentUserId
    });

    if (!userWithRequest) {
      return res.status(404).send({ error: 'Friend request not found' });
    }

    // Remove the request
    await User.updateOne(
      { _id: userWithRequest._id },
      { $pull: { friendRequests: { _id: requestId } } }
    );

    res.send({ message: 'Friend request cancelled successfully' });
  } catch (err) {
    res.status(400).send({ error: err.message });
  }
});

// Remove a friend
router.delete("/remove/:friendId", auth, async (req, res) => {
  try {
    const { friendId } = req.params;
    const currentUserId = req.auth.id;

    // Prevent self-removal
    if (currentUserId === friendId) {
      return res.status(400).send({ error: "You cannot remove yourself as a friend" });
    }

    // Check if users exist
    const [currentUser, friendUser] = await Promise.all([
      User.findById(currentUserId),
      User.findById(friendId)
    ]);

    if (!currentUser || !friendUser) {
      return res.status(404).send({ error: "User not found" });
    }

    // Check if they are actually friends
    const isFriend = currentUser.friends.includes(friendId);
    if (!isFriend) {
      return res.status(400).send({ error: "You are not friends with this user" });
    }

    // Remove from both users' friend lists
    await Promise.all([
      User.findByIdAndUpdate(currentUserId, {
        $pull: { friends: friendId }
      }),
      User.findByIdAndUpdate(friendId, {
        $pull: { friends: currentUserId }
      })
    ]);

    res.send({ message: "Friend removed successfully" });
  } catch (err) {
    console.error('Remove friend error:', err);
    res.status(400).send({ error: err.message });
  }
});

// Get friend challenges
router.get("/challenges", auth, async (req, res) => {
  try {
    const currentUserId = req.auth.id;
    
    // Get user's friends
    const user = await User.findById(currentUserId).populate('friends');
    const friendIds = user.friends.map(friend => friend._id);
    
    // Find challenges that include the current user or their friends
    const challenges = await FriendChallenge.find({
      $or: [
        { creator: currentUserId },
        { participants: { $in: friendIds } }
      ]
    })
    .populate('creator', 'name email publicProfile')
    .populate('participants.user', 'name email publicProfile')
    .sort({ createdAt: -1 });

    res.send({ challenges });
  } catch (err) {
    console.error('Friend challenges error:', err);
    res.status(400).send({ error: err.message });
  }
});

// Create a friend challenge
router.post("/challenges", auth, async (req, res) => {
  try {
    const { title, description, type, duration, participants } = req.body;
    const creatorId = req.auth.id;

    const challenge = await FriendChallenge.create({
      title,
      description,
      type,
      duration,
      creator: creatorId,
      participants: participants.map(userId => ({
        user: userId,
        status: 'pending'
      }))
    });

    await challenge.populate('creator', 'name email publicProfile');
    await challenge.populate('participants.user', 'name email publicProfile');

    res.status(201).send(challenge);
  } catch (err) {
    console.error('Create challenge error:', err);
    res.status(400).send({ error: err.message });
  }
});

export default router; 