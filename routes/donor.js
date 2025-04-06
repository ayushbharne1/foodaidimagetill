const express = require("express");
const router = express.Router();
const middleware = require("../middleware/index.js");
const User = require("../models/user.js");
const Donation = require("../models/donation.js");
const upload = require("../middleware/upload.js");
const cloudinary = require("../config/cloudinary.js");
const fs = require("fs");


router.get("/donor/dashboard", middleware.ensureDonorLoggedIn, async (req,res) => {
	const donorId = req.user._id;
	const numPendingDonations = await Donation.countDocuments({ donor: donorId, status: "pending" });
	const numAcceptedDonations = await Donation.countDocuments({ donor: donorId, status: "accepted" });
	const numAssignedDonations = await Donation.countDocuments({ donor: donorId, status: "assigned" });
	const numCollectedDonations = await Donation.countDocuments({ donor: donorId, status: "collected" });
	res.render("donor/dashboard", {
		title: "Dashboard",
		numPendingDonations, numAcceptedDonations, numAssignedDonations, numCollectedDonations
	});
});

router.get("/donor/donate", middleware.ensureDonorLoggedIn, (req,res) => {
	res.render("donor/donate", { title: "Donate" });
});

router.post("/donor/donate", middleware.ensureDonorLoggedIn, upload.single('image'), async (req,res) => {
	try {
		// Create donation object from form data
		const donation = {
			foodType: req.body.foodType,
			quantity: req.body.quantity,
			cookingTime: req.body.cookingTime,
			address: req.body.address,
			location: {
				latitude: parseFloat(req.body.latitude),
				longitude: parseFloat(req.body.longitude)
			},
			phone: req.body.phone,
			donorToAdminMsg: req.body.donorToAdminMsg,
			status: "pending",
			donor: req.user._id
		};

		// Upload image to Cloudinary if provided
		if (req.file) {
			try {
				// Validate file
				if (!req.file.mimetype.startsWith('image/')) {
					throw new Error('File must be an image');
				}

				// Upload to Cloudinary
				const result = await cloudinary.uploader.upload(req.file.path, {
					folder: 'foodaid',
					resource_type: 'auto',
					use_filename: true,
					unique_filename: true
				});

				if (!result || !result.secure_url) {
					throw new Error('Failed to upload image to Cloudinary');
				}

				donation.image = result.secure_url;
				
				// Delete the temporary file
				fs.unlinkSync(req.file.path);
			} catch (uploadError) {
				console.error('Error uploading image:', uploadError);
				// Delete temporary file if it exists
				if (req.file && req.file.path) {
					try {
						fs.unlinkSync(req.file.path);
					} catch (unlinkError) {
						console.error('Error deleting temporary file:', unlinkError);
					}
				}
				req.flash("error", "Error uploading image. Please try again.");
				return res.redirect("back");
			}
		}

		// Create and save the donation
		const newDonation = new Donation(donation);
		await newDonation.save();
		
		req.flash("success", "Donation request sent successfully");
		res.redirect("/donor/donations/pending");
	} catch(err) {
		console.error('Error creating donation:', err);
		req.flash("error", "Some error occurred on the server.");
		res.redirect("back");
	}
});

router.get("/donor/donations/pending", middleware.ensureDonorLoggedIn, async (req,res) => {
	try
	{
		const pendingDonations = await Donation.find({ donor: req.user._id, status: ["pending", "rejected", "accepted", "assigned"] }).populate("agent");
		res.render("donor/pendingDonations", { title: "Pending Donations", pendingDonations });
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
});

router.get("/donor/donations/previous", middleware.ensureDonorLoggedIn, async (req,res) => {
	try
	{
		const previousDonations = await Donation.find({ donor: req.user._id, status: "collected" }).populate("agent");
		res.render("donor/previousDonations", { title: "Previous Donations", previousDonations });
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
});

router.get("/donor/donation/deleteRejected/:donationId", async (req,res) => {
	try
	{
		const donationId = req.params.donationId;
		await Donation.findByIdAndDelete(donationId);
		res.redirect("/donor/donations/pending");
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
});

router.get("/donor/profile", middleware.ensureDonorLoggedIn, (req,res) => {
	res.render("donor/profile", { title: "My Profile" });
});

router.put("/donor/profile", middleware.ensureDonorLoggedIn, async (req,res) => {
	try
	{
		const id = req.user._id;
		const updateObj = req.body.donor;	// updateObj: {firstName, lastName, gender, address, phone}
		await User.findByIdAndUpdate(id, updateObj);
		
		req.flash("success", "Profile updated successfully");
		res.redirect("/donor/profile");
	}
	catch(err)
	{
		console.log(err);
		req.flash("error", "Some error occurred on the server.")
		res.redirect("back");
	}
	
});


module.exports = router;