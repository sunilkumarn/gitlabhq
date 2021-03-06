# frozen_string_literal: true

require 'spec_helper'

describe API::Entities::User do
  let(:user) { create(:user) }
  let(:current_user) { create(:user) }

  subject { described_class.new(user, current_user: current_user).as_json }

  it 'exposes correct attributes' do
    expect(subject).to include(:bio, :location, :public_email, :skype, :linkedin, :twitter, :website_url, :organization, :job_title, :work_information)
  end

  it 'exposes created_at if the current user can read the user profile' do
    allow(Ability).to receive(:allowed?).with(current_user, :read_user_profile, user).and_return(true)

    expect(subject).to include(:created_at)
  end

  it 'does not expose created_at if the current user cannot read the user profile' do
    allow(Ability).to receive(:allowed?).with(current_user, :read_user_profile, user).and_return(false)

    expect(subject).not_to include(:created_at)
  end
end
